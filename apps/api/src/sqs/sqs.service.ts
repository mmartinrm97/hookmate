import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SQSClient } from '@aws-sdk/client-sqs';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

export interface IngestionMessage {
  event_id: string;
  endpoint_id: string;
  trace_id: string;
  received_at: string;
}

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);

  constructor(
    @Inject('SQS_CLIENT')
    private readonly sqsClient: SQSClient,
    @Inject('SQS_QUEUE_URL')
    private readonly queueUrl: string,
  ) {}

  async publish(message: IngestionMessage): Promise<void> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      });

      await this.sqsClient.send(command);
    } catch (error) {
      this.logger.error(
        `Failed to publish ingestion message to SQS: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
