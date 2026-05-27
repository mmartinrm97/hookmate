import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { type IVpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { type IFunction, Function, Code, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { type ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { type IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface ComputeStackProps extends StackProps {
  /** VPC for Lambda network placement */
  readonly vpc: IVpc;

  /** Secrets Manager secret for DB credentials */
  readonly dbSecret: ISecret;

  /** Redis endpoint hostname */
  readonly redisEndpoint: string;

  /** Redis endpoint port */
  readonly redisPort: number;

  /** Ingestion queue for webhook events */
  readonly ingestionQueue: IQueue;

  /** Dead-letter queue for failed events */
  readonly dlq: IQueue;

  /** Retry queue for BullMQ scheduled retries */
  readonly retryQueue: IQueue;

  /** AI job queue for background AI summary/classification jobs */
  readonly aiJobQueue: IQueue;

  /** OpenAI API key secret (stored in Secrets Manager) */
  readonly openAiSecret: ISecret;
}

export class ComputeStack extends Stack {
  /** Lambda that handles POST /webhooks/{endpointId} */
  public readonly ingestionLambda: IFunction;

  /** Lambda that consumes events from the ingestion queue and delivers them */
  public readonly processorLambda: IFunction;

  /** Lambda that handles dead-letter queue promotion and context capture */
  public readonly dlqLambda: IFunction;

  /** Lambda that generates AI summaries and classifies events */
  public readonly aiLambda: IFunction;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const {
      vpc,
      dbSecret,
      redisEndpoint,
      redisPort,
      ingestionQueue,
      dlq,
      retryQueue,
      aiJobQueue,
      openAiSecret,
    } = props;

    // --- Common Lambda Configuration ---
    // All Lambdas share the same code artifact (the compiled NestJS API output).
    // Each Lambda uses a different handler entry point within that bundle.
    // Node.js 20.x, 256MB memory, 30s timeout, X-Ray tracing enabled.
    const commonLambdaProps = {
      runtime: Runtime.NODEJS_20_X,
      code: Code.fromAsset('../apps/api/dist/src'),
      memorySize: 256,
      timeout: Duration.seconds(30),
      tracing: Tracing.ACTIVE,
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    };

    const commonEnv = {
      DB_SECRET_ARN: dbSecret.secretArn,
      REDIS_URL: `redis://${redisEndpoint}:${redisPort}`,
      OPENAI_API_KEY_SECRET_ARN: openAiSecret.secretArn,
    };

    // --- Ingestion Lambda ---
    // Handles POST /webhooks/{endpointId}. Validates the endpoint exists,
    // persists the event to PostgreSQL, publishes to ingestion SQS queue,
    // and returns 202 Accepted.
    this.ingestionLambda = new Function(this, 'IngestionFunction', {
      ...commonLambdaProps,
      handler: 'lambda/ingestion.handler',
      description: 'Webhook ingestion — validates endpoint, persists event, enqueues to SQS',
      environment: {
        ...commonEnv,
        QUEUE_URL: ingestionQueue.queueUrl,
      },
    });

    // Ingestion: needs to send messages to the ingestion queue
    ingestionQueue.grantSendMessages(this.ingestionLambda);
    // Ingestion: needs to read DB credentials
    dbSecret.grantRead(this.ingestionLambda);
    // Ingestion: needs to read the OpenAI key for event classification
    openAiSecret.grantRead(this.ingestionLambda);

    // --- Processor Lambda ---
    // Triggered by SQS (ingestion queue). Evaluates routing rules, delivers
    // the webhook payload to the configured destination, records delivery
    // attempts. On failure, schedules retry via BullMQ or promotes to DLQ.
    this.processorLambda = new Function(this, 'ProcessorFunction', {
      ...commonLambdaProps,
      handler: 'lambda/processor.handler',
      description: 'Event processor — delivers webhook payload, handles retries and DLQ promotion',
      environment: {
        ...commonEnv,
        INGESTION_QUEUE_URL: ingestionQueue.queueUrl,
        RETRY_QUEUE_URL: retryQueue.queueUrl,
        DLQ_URL: dlq.queueUrl,
      },
    });

    // Processor: needs to receive/delete from ingestion queue (SQS event source)
    ingestionQueue.grantConsumeMessages(this.processorLambda);
    ingestionQueue.grantSendMessages(this.processorLambda); // for visibility timeout changes
    // Processor: needs to send to retry and DLQ
    retryQueue.grantSendMessages(this.processorLambda);
    dlq.grantSendMessages(this.processorLambda);
    // Processor: needs DB + OpenAI key access
    dbSecret.grantRead(this.processorLambda);
    openAiSecret.grantRead(this.processorLambda);

    // --- DLQ Lambda ---
    // Triggered by the DLQ SQS queue. Captures full failure context
    // (all delivery attempt records, original payload, final error reason)
    // and writes a `dlq_events` row. If DLQ threshold is exceeded,
    // publishes to SNS alarm topic.
    this.dlqLambda = new Function(this, 'DlqFunction', {
      ...commonLambdaProps,
      handler: 'lambda/dlq.handler',
      description: 'DLQ handler — captures failure context, writes dlq_events row',
      environment: {
        ...commonEnv,
        DLQ_URL: dlq.queueUrl,
      },
    });

    // DLQ: needs to receive/delete from DLQ
    dlq.grantConsumeMessages(this.dlqLambda);
    // DLQ: needs DB access
    dbSecret.grantRead(this.dlqLambda);

    // --- AI Lambda ---
    // Triggered by EventBridge Scheduler every 30 minutes. Aggregates events
    // from the last 24h per endpoint, calls OpenAI gpt-4o-mini to generate
    // natural-language summaries, and upserts `ai_summaries` rows.
    // Also classifies individual events into categories.
    this.aiLambda = new Function(this, 'AiFunction', {
      ...commonLambdaProps,
      handler: 'lambda/ai.handler',
      timeout: Duration.minutes(5), // AI calls may take longer
      description: 'AI background worker — generates event summaries and classifies events',
      environment: {
        ...commonEnv,
        AI_JOB_QUEUE_URL: aiJobQueue.queueUrl,
      },
    });

    // AI: needs DB access
    dbSecret.grantRead(this.aiLambda);
    // AI: needs OpenAI API key
    openAiSecret.grantRead(this.aiLambda);
    // AI: can send to its own job queue
    aiJobQueue.grantSendMessages(this.aiLambda);

    // --- Outputs ---
    new CfnOutput(this, 'IngestionFunctionArn', {
      value: this.ingestionLambda.functionArn,
      description: 'Ingestion Lambda ARN',
    });

    new CfnOutput(this, 'ProcessorFunctionArn', {
      value: this.processorLambda.functionArn,
      description: 'Processor Lambda ARN',
    });

    new CfnOutput(this, 'DlqFunctionArn', {
      value: this.dlqLambda.functionArn,
      description: 'DLQ Lambda ARN',
    });

    new CfnOutput(this, 'AiFunctionArn', {
      value: this.aiLambda.functionArn,
      description: 'AI Lambda ARN',
    });
  }
}
