import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import type { SqsReceivedMessage } from '../sqs/sqs.service';
import { SqsService } from '../sqs/sqs.service';
import { ConfigService } from '@nestjs/config';
import { ProcessorService } from './processor.service';
import { SqsConsumerService } from './sqs-consumer.service';
import type { ProcessResult } from './processor.types';

describe('SqsConsumerService', () => {
  let service: SqsConsumerService;
  let mockSqsService: {
    receiveMessage: ReturnType<typeof vi.fn>;
    deleteMessage: ReturnType<typeof vi.fn>;
  };
  let mockProcessorService: {
    process: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSqsService = {
      receiveMessage: vi.fn(),
      deleteMessage: vi.fn(),
    };
    mockProcessorService = {
      process: vi.fn(),
    };
    mockConfigService = {
      get: vi.fn().mockReturnValue(undefined), // use defaults
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsConsumerService,
        { provide: SqsService, useValue: mockSqsService },
        { provide: ProcessorService, useValue: mockProcessorService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SqsConsumerService>(SqsConsumerService);
  });

  afterEach(() => {
    if (service) {
      service.onModuleDestroy();
    }
  });

  describe('poll()', () => {
    it('receives messages and processes each one', async () => {
      const messages: SqsReceivedMessage[] = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            event_id: 'evt-1',
            endpoint_id: 'ep-1',
            trace_id: 'trace-1',
            received_at: '2026-01-15T12:00:00Z',
          },
        },
        {
          messageId: 'msg-2',
          receiptHandle: 'receipt-2',
          body: {
            event_id: 'evt-2',
            endpoint_id: 'ep-2',
            trace_id: 'trace-2',
            received_at: '2026-01-15T12:00:01Z',
          },
        },
      ];
      mockSqsService.receiveMessage.mockResolvedValue(messages);
      mockProcessorService.process.mockResolvedValue({} as ProcessResult);

      await service.poll();

      expect(mockSqsService.receiveMessage).toHaveBeenCalledWith(10, 5);
      expect(mockProcessorService.process).toHaveBeenCalledTimes(2);
      expect(mockProcessorService.process).toHaveBeenCalledWith({
        event_id: 'evt-1',
        endpoint_id: 'ep-1',
        attempt_number: 0,
      });
    });

    it('deletes SQS message after successful processing', async () => {
      const messages: SqsReceivedMessage[] = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            event_id: 'evt-1',
            endpoint_id: 'ep-1',
            trace_id: 'trace-1',
            received_at: '2026-01-15T12:00:00Z',
          },
        },
      ];
      mockSqsService.receiveMessage.mockResolvedValue(messages);
      mockProcessorService.process.mockResolvedValue({} as ProcessResult);

      await service.poll();

      expect(mockSqsService.deleteMessage).toHaveBeenCalledWith('receipt-1');
    });

    it('deletes SQS message even when processing fails (poison pill)', async () => {
      const messages: SqsReceivedMessage[] = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            event_id: 'evt-1',
            endpoint_id: 'ep-1',
            trace_id: 'trace-1',
            received_at: '2026-01-15T12:00:00Z',
          },
        },
      ];
      mockSqsService.receiveMessage.mockResolvedValue(messages);
      mockProcessorService.process.mockRejectedValue(new Error('Processing failed'));

      await service.poll();

      expect(mockSqsService.deleteMessage).toHaveBeenCalledWith('receipt-1');
    });

    it('handles empty message batch gracefully', async () => {
      mockSqsService.receiveMessage.mockResolvedValue([]);

      await service.poll();

      expect(mockProcessorService.process).not.toHaveBeenCalled();
      expect(mockSqsService.deleteMessage).not.toHaveBeenCalled();
    });

    it('handles SQS receive failure gracefully', async () => {
      mockSqsService.receiveMessage.mockRejectedValue(new Error('SQS error'));

      await expect(service.poll()).resolves.not.toThrow();
    });

    it('processes messages with missing fields gracefully', async () => {
      const messages: SqsReceivedMessage[] = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {} as Record<string, unknown>,
        },
      ];
      mockSqsService.receiveMessage.mockResolvedValue(messages);
      mockProcessorService.process.mockResolvedValue({} as ProcessResult);

      await service.poll();

      expect(mockProcessorService.process).toHaveBeenCalledWith({
        event_id: undefined,
        endpoint_id: undefined,
        attempt_number: 0,
      });
    });

    it('continues processing remaining messages after one message fails', async () => {
      const messages: SqsReceivedMessage[] = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            event_id: 'evt-1',
            endpoint_id: 'ep-1',
            trace_id: 'trace-1',
            received_at: '2026-01-15T12:00:00Z',
          },
        },
        {
          messageId: 'msg-2',
          receiptHandle: 'receipt-2',
          body: {
            event_id: 'evt-2',
            endpoint_id: 'ep-2',
            trace_id: 'trace-2',
            received_at: '2026-01-15T12:00:01Z',
          },
        },
      ];
      mockSqsService.receiveMessage.mockResolvedValue(messages);
      mockProcessorService.process
        .mockRejectedValueOnce(new Error('First message failed'))
        .mockResolvedValueOnce({} as ProcessResult);

      await service.poll();

      expect(mockProcessorService.process).toHaveBeenCalledTimes(2);
      expect(mockSqsService.deleteMessage).toHaveBeenCalledTimes(2);
    });

    it('does not call receiveMessage with invalid parameters', async () => {
      // Just test that receiveMessage is called with the right defaults
      mockSqsService.receiveMessage.mockResolvedValue([]);
      await service.poll();
      expect(mockSqsService.receiveMessage).toHaveBeenCalledWith(10, 5);
    });
  });

  describe('lifecycle', () => {
    it('starts polling on module init', () => {
      service.onModuleInit();
      expect(service['pollingInterval']).not.toBeNull();
    });

    it('stops polling on module destroy', () => {
      service.onModuleInit();

      service.onModuleDestroy();

      expect(service['pollingInterval']).toBeNull();
    });
  });
});
