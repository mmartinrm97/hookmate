import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SqsReceivedMessage } from '../sqs/sqs.service';
import { SqsService } from '../sqs/sqs.service';
import type { ProcessInput } from './processor.types';
import { ProcessorService } from './processor.service';

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const MAX_MESSAGES = 10;
const WAIT_TIME_SECONDS = 5;

@Injectable()
export class SqsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsConsumerService.name);
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs: number;

  constructor(
    private readonly sqsService: SqsService,
    private readonly processorService: ProcessorService,
    configService: ConfigService,
  ) {
    this.pollIntervalMs =
      configService.get<number>('SQS_POLL_INTERVAL_MS') ?? DEFAULT_POLL_INTERVAL_MS;
  }

  onModuleInit(): void {
    this.logger.log(`Starting SQS consumer with poll interval ${this.pollIntervalMs}ms`);
    this.pollingInterval = setInterval(() => {
      this.poll().catch((error) => {
        this.logger.error(`Poll cycle failed: ${(error as Error).message}`, (error as Error).stack);
      });
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.logger.log('SQS consumer stopped');
    }
  }

  /**
   * Polls SQS for messages, processes each one, and deletes them after processing.
   */
  async poll(): Promise<void> {
    let messages: SqsReceivedMessage[] = [];

    try {
      messages = await this.sqsService.receiveMessage(MAX_MESSAGES, WAIT_TIME_SECONDS);
    } catch (error) {
      this.logger.error(
        `Failed to receive messages from SQS: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return;
    }

    if (messages.length === 0) {
      return;
    }

    this.logger.log(`Received ${messages.length} message(s) from SQS`);

    for (const message of messages) {
      const input: ProcessInput = {
        event_id: (message.body as Record<string, string>).event_id,
        endpoint_id: (message.body as Record<string, string>).endpoint_id,
        attempt_number: 0,
      };

      try {
        await this.processorService.process(input);
      } catch (error) {
        this.logger.error(
          `Failed to process message ${message.messageId}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }

      try {
        await this.sqsService.deleteMessage(message.receiptHandle);
      } catch (error) {
        this.logger.error(
          `Failed to delete message ${message.messageId}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }
}
