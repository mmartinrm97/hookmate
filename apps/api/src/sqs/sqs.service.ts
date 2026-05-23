import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SQSClient } from '@aws-sdk/client-sqs';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

export interface IngestionMessage {
  event_id: string;
  endpoint_id: string;
  trace_id: string;
  received_at: string;
}

export interface SqsReceivedMessage {
  messageId: string;
  receiptHandle: string;
  body: Record<string, unknown>;
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

  async receiveMessage(
    maxNumberOfMessages: number,
    waitTimeSeconds: number,
  ): Promise<SqsReceivedMessage[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxNumberOfMessages,
        WaitTimeSeconds: waitTimeSeconds,
      });

      const result = await this.sqsClient.send(command);

      if (!result.Messages || result.Messages.length === 0) {
        return [];
      }

      return result.Messages.map((msg) => ({
        messageId: msg.MessageId ?? '',
        receiptHandle: msg.ReceiptHandle ?? '',
        body: JSON.parse(msg.Body ?? '{}') as Record<string, unknown>,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to receive messages from SQS: ${(error as Error).message}`,
        (error as Error).stack,
      );

      return [];
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
    } catch (error) {
      this.logger.error(
        `Failed to delete SQS message: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
