# 9. Infrastructure — AWS CDK

> [← Back to index](./README.md)

## 9.1 Stack structure

```
HookMateApp (CDK App)
├── NetworkStack         — VPC, subnets, NAT gateway, security groups
├── DatabaseStack        — RDS PostgreSQL, Secrets Manager credentials
├── QueueStack           — SQS ingestion queue, DLQ, SNS alarm topic
├── CacheStack           — ElastiCache Redis cluster
├── LambdaStack          — All Lambda functions + API Gateway HTTP API
├── SchedulerStack       — EventBridge Scheduler for AI background job
├── DashboardStack       — S3 bucket, CloudFront distribution
└── ObservabilityStack   — CloudWatch dashboards and alarms
```

## 9.2 Key CDK constructs

```typescript
// DatabaseStack — RDS PostgreSQL
const db = new rds.DatabaseInstance(this, 'HookMateDb', {
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  multiAz: false,
  storageEncrypted: true,
  deletionProtection: false,
  credentials: rds.Credentials.fromGeneratedSecret('hookmate_admin'),
});

// QueueStack — SQS queues
const dlq = new sqs.Queue(this, 'IngestionDLQ', {
  retentionPeriod: Duration.days(14),
  encryption: sqs.QueueEncryption.KMS_MANAGED,
});

const ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
  visibilityTimeout: Duration.seconds(30),
  retentionPeriod: Duration.days(4),
  deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
  encryption: sqs.QueueEncryption.KMS_MANAGED,
});

// LambdaStack — Processor Lambda
const processorFn = new lambda.Function(this, 'ProcessorLambda', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'dist/lambda/processor.handler',
  code: lambda.Code.fromAsset('../apps/api', { exclude: ['node_modules'] }),
  timeout: Duration.seconds(60),
  memorySize: 512,
  environment: {
    DB_SECRET_ARN: db.secret!.secretArn,
    REDIS_URL: redisEndpoint,
    SQS_DLQ_URL: dlq.queueUrl,
  },
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
});
ingestionQueue.grantConsumeMessages(processorFn);

// DLQ Alarm
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQDepthAlarm', {
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 100,
  evaluationPeriods: 1,
  alarmDescription: 'DLQ depth exceeded 100 messages',
});
dlqAlarm.addAlarmAction(new cwActions.SnsAction(alarmTopic));
```

## 9.3 VPC design

```
VPC: 10.0.0.0/16 (hookmate-vpc)

Public subnets (2 AZs):  10.0.0.0/24, 10.0.1.0/24
  └── NAT Gateway (1, in us-east-1a)
  └── API Gateway VPC endpoint

Private subnets (2 AZs): 10.0.10.0/24, 10.0.11.0/24
  └── Lambda functions
  └── RDS PostgreSQL
  └── ElastiCache Redis
```

## 9.4 Secrets Manager entries

| Secret name               | Contents                                                    |
| ------------------------- | ----------------------------------------------------------- |
| `hookmate/db/master`      | `{ username, password, host, port, dbname }` (auto-rotated) |
| `hookmate/api-key`        | API key for dashboard authentication                        |
| `hookmate/openai-api-key` | OpenAI API key for AI background Lambda                     |
