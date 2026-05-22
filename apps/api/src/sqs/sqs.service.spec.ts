import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SqsService } from './sqs.service';

const mockSend = vi.fn();
const mockQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/ingestion';
const mockSendMessageInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => ({ send: mockSend })),
  SendMessageCommand: class MockSendMessageCommand {
    constructor(input: Record<string, unknown>) {
      mockSendMessageInputs.push(input);
    }
  },
}));

describe('SqsService', () => {
  let service: SqsService;

  beforeEach(async () => {
    mockSend.mockReset();
    mockSendMessageInputs.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsService,
        {
          provide: 'SQS_CLIENT',
          useValue: { send: mockSend },
        },
        {
          provide: 'SQS_QUEUE_URL',
          useValue: mockQueueUrl,
        },
      ],
    }).compile();

    service = module.get<SqsService>(SqsService);
  });

  describe('publish()', () => {
    it('sends a message to the SQS queue', async () => {
      mockSend.mockResolvedValue({ MessageId: 'msg-123' });

      const message = {
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        trace_id: 'trace-abc',
        received_at: '2026-01-15T12:00:00Z',
      };

      await service.publish(message);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('serializes the message body as JSON', async () => {
      mockSend.mockResolvedValue({ MessageId: 'msg-456' });

      await service.publish({
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        trace_id: 'trace-abc',
        received_at: '2026-01-15T12:00:00Z',
      });

      const commandInput = mockSendMessageInputs[0] as { QueueUrl: string; MessageBody: string };

      expect(commandInput).toBeDefined();
      expect(commandInput.QueueUrl).toBe(mockQueueUrl);

      const parsedBody = JSON.parse(commandInput.MessageBody);

      expect(parsedBody).toEqual({
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
        trace_id: 'trace-abc',
        received_at: '2026-01-15T12:00:00Z',
      });
    });

    it('logs error and does not throw when SQS send fails', async () => {
      const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      const sqsError = new Error('Network error');
      mockSend.mockRejectedValue(sqsError);

      await expect(
        service.publish({
          event_id: 'evt-01JHQ',
          endpoint_id: 'ep-01JHQ',
          trace_id: 'trace-abc',
          received_at: '2026-01-15T12:00:00Z',
        }),
      ).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      loggerErrorSpy.mockRestore();
    });
  });
});
