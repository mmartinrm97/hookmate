import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class QueueStack extends Stack {
  /** Dead-letter queue — messages that failed all retry attempts */
  public readonly dlq: Queue;

  /** Main ingestion queue — webhook events are published here by Ingestion Lambda */
  public readonly ingestionQueue: Queue;

  /** Retry queue — scheduled retry jobs via BullMQ (processor side) */
  public readonly retryQueue: Queue;

  /** AI job queue — background AI summary/classification jobs */
  public readonly aiJobQueue: Queue;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- Dead-Letter Queue ---
    // Long retention (14 days) so operators have time to inspect and retry failed events.
    this.dlq = new Queue(this, 'HookMateDLQ', {
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.seconds(30),
      queueName: 'hookmate-dlq',
    });

    // --- Ingestion Queue ---
    // Webhook events land here after the Ingestion Lambda writes them to the DB.
    // After 3 failed delivery attempts, the message moves to the DLQ.
    this.ingestionQueue = new Queue(this, 'HookMateIngestionQueue', {
      visibilityTimeout: Duration.seconds(30),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 3,
      },
      queueName: 'hookmate-ingestion',
    });

    // --- Retry Queue ---
    // BullMQ uses this queue to schedule retry jobs with exponential backoff.
    // Separate from ingestion to avoid head-of-line blocking on retries.
    this.retryQueue = new Queue(this, 'HookMateRetryQueue', {
      visibilityTimeout: Duration.seconds(30),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 5,
      },
      queueName: 'hookmate-retry',
    });

    // --- AI Job Queue ---
    // Lightweight queue for AI summary/classification background jobs.
    // Shorter timeout since AI calls may take a bit longer.
    this.aiJobQueue = new Queue(this, 'HookMateAIJobQueue', {
      visibilityTimeout: Duration.seconds(60),
      retentionPeriod: Duration.days(1),
      queueName: 'hookmate-ai-jobs',
    });

    // --- Outputs ---
    new CfnOutput(this, 'DlqUrl', {
      value: this.dlq.queueUrl,
      description: 'Dead-letter queue URL',
    });

    new CfnOutput(this, 'IngestionQueueUrl', {
      value: this.ingestionQueue.queueUrl,
      description: 'Ingestion queue URL',
    });

    new CfnOutput(this, 'RetryQueueUrl', {
      value: this.retryQueue.queueUrl,
      description: 'Retry queue URL',
    });

    new CfnOutput(this, 'AiJobQueueUrl', {
      value: this.aiJobQueue.queueUrl,
      description: 'AI job queue URL',
    });
  }
}
