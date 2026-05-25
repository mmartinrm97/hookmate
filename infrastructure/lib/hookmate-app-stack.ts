import { Stack, type StackProps } from 'aws-cdk-lib';
import { IpAddresses, SubnetType, Vpc, type IVpc } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

import { DatabaseStack } from './database-stack.js';
import { CacheStack } from './cache-stack.js';
import { QueueStack } from './queue-stack.js';
import { ComputeStack } from './compute-stack.js';
import { ApiStack } from './api-stack.js';
import { SchedulerStack } from './scheduler-stack.js';
import { MonitoringStack } from './monitoring-stack.js';
import { FrontendStack } from './frontend-stack.js';

/**
 * HookMateAppStack — Top-level orchestrator.
 *
 * Creates the shared VPC once and wires all sub-stacks together.
 * Each sub-stack receives only the props it needs via explicit typed interfaces.
 *
 * Deploy order (automatically inferred via CDK cross-stack references):
 *   1. QueueStack (no dependencies)
 *   2. FrontendStack (no dependencies)
 *   3. DatabaseStack (depends on VPC)
 *   4. CacheStack (depends on VPC)
 *   5. ComputeStack (depends on Database, Cache, Queue)
 *   6. ApiStack (depends on Compute for Ingestion Lambda)
 *   7. SchedulerStack (depends on Compute for AI Lambda)
 *   8. MonitoringStack (depends on all)
 */
export class HookMateAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =========================================================================
    // 1. Shared VPC
    // =========================================================================
    // VPC with public subnets (NAT Gateway for Lambda egress) and private
    // subnets (RDS, ElastiCache). 2 AZs for basic HA within cost constraints.
    const vpc: IVpc = new Vpc(this, 'HookMateVPC', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          // Private subnets with NAT Gateway egress — used by Lambda functions
          // that need internet access (e.g., Processor Lambda delivering webhooks)
          name: 'Private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
      natGateways: 1, // single NAT Gateway for cost optimization
    });

    // =========================================================================
    // 2. OpenAI API Key (reference to existing Secrets Manager secret)
    // =========================================================================
    // This secret must be created manually post-deploy:
    //   aws secretsmanager create-secret --name hookmate/openai_api_key --secret-string "<key>"
    const openAiSecret = Secret.fromSecretNameV2(this, 'OpenAIAPIKey', 'hookmate/openai_api_key');

    // =========================================================================
    // 3. Stack Instantiation (ordered by dependency)
    // =========================================================================

    // QueueStack — SQS queues (no VPC dependency)
    const queueStack = new QueueStack(this, 'HookMateQueueStack', {
      env: props?.env,
      description: 'SQS queues for ingestion, retry, AI jobs, and DLQ',
    });

    // FrontendStack — S3 + CloudFront (no VPC dependency)
    const frontendStack = new FrontendStack(this, 'HookMateFrontendStack', {
      env: props?.env,
      description: 'S3 bucket and CloudFront distribution for dashboard',
    });

    // DatabaseStack — RDS PostgreSQL 16 + security group
    const databaseStack = new DatabaseStack(this, 'HookMateDatabaseStack', {
      vpc,
      env: props?.env,
      description: 'RDS PostgreSQL 16 with auto-generated admin credentials',
    });

    // CacheStack — ElastiCache Redis 7 + security group
    const cacheStack = new CacheStack(this, 'HookMateCacheStack', {
      vpc,
      env: props?.env,
      description: 'ElastiCache Redis 7 single-node cluster',
    });

    // ComputeStack — Lambda functions (Ingestion, Processor, DLQ, AI)
    const computeStack = new ComputeStack(this, 'HookMateComputeStack', {
      vpc,
      dbSecret: databaseStack.dbSecret,
      redisEndpoint: cacheStack.redisEndpoint,
      redisPort: cacheStack.redisPort,
      ingestionQueue: queueStack.ingestionQueue,
      dlq: queueStack.dlq,
      retryQueue: queueStack.retryQueue,
      aiJobQueue: queueStack.aiJobQueue,
      openAiSecret,
      env: props?.env,
      description: 'Lambda functions for webhook ingestion, processing, DLQ, and AI',
    });

    // ApiStack — API Gateway HTTP API + NestJS API handler Lambda
    const apiStack = new ApiStack(this, 'HookMateApiStack', {
      vpc,
      ingestionLambda: computeStack.ingestionLambda,
      dbSecret: databaseStack.dbSecret,
      openAiSecret,
      env: props?.env,
      description: 'API Gateway HTTP API routing to Ingestion Lambda and NestJS handler',
    });

    // SchedulerStack — EventBridge rule for AI summary cron trigger
    const schedulerStack = new SchedulerStack(this, 'HookMateSchedulerStack', {
      aiLambda: computeStack.aiLambda,
      env: props?.env,
      description: 'EventBridge rule for AI summary generation every 30 minutes',
    });

    // MonitoringStack — CloudWatch dashboard, alarms, SNS topic
    const monitoringStack = new MonitoringStack(this, 'HookMateMonitoringStack', {
      ingestionQueue: queueStack.ingestionQueue,
      dlq: queueStack.dlq,
      retryQueue: queueStack.retryQueue,
      aiJobQueue: queueStack.aiJobQueue,
      ingestionLambda: computeStack.ingestionLambda,
      processorLambda: computeStack.processorLambda,
      dlqLambda: computeStack.dlqLambda,
      aiLambda: computeStack.aiLambda,
      apiHandlerLambda: apiStack.apiHandlerLambda,
      rdsInstance: databaseStack.dbInstance,
      cacheClusterId: cacheStack.cacheCluster.ref,
      httpApiId: apiStack.httpApi.apiId,
      env: props?.env,
      description: 'CloudWatch dashboard, operational alarms, and SNS notification topic',
    });

    // =========================================================================
    // 4. Explicit dependency ordering (belt-and-suspenders)
    // =========================================================================
    // CDK automatically creates cross-stack references when L2 constructs are
    // passed as props, but explicit dependencies ensure correct deploy order
    // in edge cases like initial bootstrap or parallel stack operations.

    computeStack.addDependency(databaseStack);
    computeStack.addDependency(cacheStack);
    computeStack.addDependency(queueStack);

    apiStack.addDependency(computeStack);

    schedulerStack.addDependency(computeStack);

    monitoringStack.addDependency(apiStack);
    monitoringStack.addDependency(computeStack);
    monitoringStack.addDependency(databaseStack);
    monitoringStack.addDependency(cacheStack);
    monitoringStack.addDependency(queueStack);

    // Suppress unused variable warnings (TypeScript may flag them)
    void frontendStack;
    void schedulerStack;
    void monitoringStack;
  }
}
