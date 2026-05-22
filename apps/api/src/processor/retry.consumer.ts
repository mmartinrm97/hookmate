import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ProcessorService } from './processor.service';
import type { RetryJobData } from './processor.types';

@Processor('retries')
export class RetryConsumer {
  private readonly logger = new Logger(RetryConsumer.name);

  constructor(private readonly processorService: ProcessorService) {}

  /**
   * Handles retry jobs from the 'retries' Bull queue.
   * Delegates to ProcessorService.process() with the original event/endpoint context.
   */
  @Process('process-retry')
  async handleRetry(job: Job<RetryJobData>): Promise<void> {
    const { event_id, endpoint_id, attempt_number } = job.data;

    try {
      this.logger.log(`Processing retry job: event=${event_id} attempt=${attempt_number}`);

      await this.processorService.process({
        event_id,
        endpoint_id,
        attempt_number,
      });
    } catch (error) {
      this.logger.error(
        `Retry job failed for event ${event_id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
