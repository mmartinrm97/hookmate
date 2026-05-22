import type { Job } from 'bull';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessorService } from './processor.service';
import { RetryConsumer } from './retry.consumer';
import type { ProcessResult, RetryJobData } from './processor.types';

describe('RetryConsumer', () => {
  let consumer: RetryConsumer;
  let mockProcessorService: {
    process: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockProcessorService = {
      process: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RetryConsumer, { provide: ProcessorService, useValue: mockProcessorService }],
    }).compile();

    consumer = module.get<RetryConsumer>(RetryConsumer);
  });

  describe('handleRetry()', () => {
    it('calls ProcessorService.process with retry job data', async () => {
      const jobData: RetryJobData = {
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        attempt_number: 3,
      };
      const job = { data: jobData } as Job<RetryJobData>;
      mockProcessorService.process.mockResolvedValue({
        status: 'failed_retry',
        eventId: 'evt-01JHQ',
        endpointId: 'ep-01JHQ',
        attemptNumber: 3,
      } satisfies ProcessResult);

      await consumer.handleRetry(job);

      expect(mockProcessorService.process).toHaveBeenCalledWith({
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        attempt_number: 3,
      });
    });

    it('logs and handles errors from ProcessorService without crashing', async () => {
      const jobData: RetryJobData = {
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        attempt_number: 2,
      };
      const job = { data: jobData } as Job<RetryJobData>;
      mockProcessorService.process.mockRejectedValue(new Error('Unexpected error'));

      await expect(consumer.handleRetry(job)).resolves.not.toThrow();
    });

    it('processes first retry (attempt_number=1) correctly', async () => {
      const jobData: RetryJobData = {
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        attempt_number: 1,
      };
      const job = { data: jobData } as Job<RetryJobData>;
      mockProcessorService.process.mockResolvedValue({
        status: 'failed_retry',
        eventId: 'evt-01JHQ',
        endpointId: 'ep-01JHQ',
        attemptNumber: 1,
      } satisfies ProcessResult);

      await consumer.handleRetry(job);

      expect(mockProcessorService.process).toHaveBeenCalledWith(
        expect.objectContaining({ attempt_number: 1 }),
      );
    });

    it('processes final retry (attempt_number=maxRetries) correctly', async () => {
      const jobData: RetryJobData = {
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        attempt_number: 5,
      };
      const job = { data: jobData } as Job<RetryJobData>;
      mockProcessorService.process.mockResolvedValue({
        status: 'dead_lettered',
        eventId: 'evt-01JHQ',
        endpointId: 'ep-01JHQ',
        attemptNumber: 5,
      } satisfies ProcessResult);

      await consumer.handleRetry(job);

      expect(mockProcessorService.process).toHaveBeenCalled();
    });

    it('handles job with missing fields gracefully', async () => {
      const jobData = {} as RetryJobData;
      const job = { data: jobData } as Job<RetryJobData>;
      mockProcessorService.process.mockResolvedValue({
        status: 'skipped',
        eventId: '',
        endpointId: '',
        attemptNumber: 0,
      } satisfies ProcessResult);

      await expect(consumer.handleRetry(job)).resolves.not.toThrow();
    });
  });
});
