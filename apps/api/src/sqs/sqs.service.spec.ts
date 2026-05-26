import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SqsService } from './sqs.service';

const mockSend = vi.fn();
const mockQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/ingestion';
const mockSendMessageInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const mockReceiveMessageInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const mockDeleteMessageInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const mockGetQueueAttributesInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => ({ send: mockSend })),
  SendMessageCommand: class MockSendMessageCommand {
    constructor(input: Record<string, unknown>) {
      mockSendMessageInputs.push(input);
    }
  },
  ReceiveMessageCommand: class MockReceiveMessageCommand {
    constructor(input: Record<string, unknown>) {
      mockReceiveMessageInputs.push(input);
    }
  },
  DeleteMessageCommand: class MockDeleteMessageCommand {
    constructor(input: Record<string, unknown>) {
      mockDeleteMessageInputs.push(input);
    }
  },
  GetQueueAttributesCommand: class MockGetQueueAttributesCommand {
    constructor(input: Record<string, unknown>) {
      mockGetQueueAttributesInputs.push(input);
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

  describe('receiveMessage()', () => {
    it('receives messages with specified max messages and wait time', async () => {
      const sqsMessages = [
        {
          MessageId: 'msg-001',
          ReceiptHandle: 'receipt-handle-1',
          Body: JSON.stringify({
            event_id: 'evt-01JHQ',
            endpoint_id: 'ep-01JHQ',
            trace_id: 'trace-abc',
            received_at: '2026-01-15T12:00:00Z',
          }),
        },
        {
          MessageId: 'msg-002',
          ReceiptHandle: 'receipt-handle-2',
          Body: JSON.stringify({
            event_id: 'evt-02JHQ',
            endpoint_id: 'ep-02JHQ',
            trace_id: 'trace-def',
            received_at: '2026-01-15T12:01:00Z',
          }),
        },
      ];
      mockSend.mockResolvedValue({ Messages: sqsMessages });

      const result = await service.receiveMessage(10, 5);

      expect(result).toHaveLength(2);
      expect(result[0]?.messageId).toBe('msg-001');
      expect(result[0]?.receiptHandle).toBe('receipt-handle-1');
      expect(result[0]?.body).toMatchObject({
        event_id: 'evt-01JHQ',
        endpoint_id: 'ep-01JHQ',
      });
      expect(result[1]?.messageId).toBe('msg-002');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandInput = mockReceiveMessageInputs[0] as {
        QueueUrl: string;
        MaxNumberOfMessages: number;
        WaitTimeSeconds: number;
      };

      expect(commandInput).toBeDefined();
      expect(commandInput.QueueUrl).toBe(mockQueueUrl);
      expect(commandInput.MaxNumberOfMessages).toBe(10);
      expect(commandInput.WaitTimeSeconds).toBe(5);
    });

    it('returns empty array when no messages are available', async () => {
      mockSend.mockResolvedValue({ Messages: undefined });

      const result = await service.receiveMessage(10, 5);

      expect(result).toEqual([]);
    });

    it('logs error and returns empty array when SQS receive fails', async () => {
      const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('SQS timeout'));

      const result = await service.receiveMessage(10, 5);

      expect(result).toEqual([]);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      loggerErrorSpy.mockRestore();
    });
  });

  describe('deleteMessage()', () => {
    it('deletes a message by receipt handle', async () => {
      mockSend.mockResolvedValue({});

      await service.deleteMessage('receipt-handle-123');

      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandInput = mockDeleteMessageInputs[0] as {
        QueueUrl: string;
        ReceiptHandle: string;
      };

      expect(commandInput).toBeDefined();
      expect(commandInput.QueueUrl).toBe(mockQueueUrl);
      expect(commandInput.ReceiptHandle).toBe('receipt-handle-123');
    });

    it('logs error and does not throw when SQS delete fails', async () => {
      const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteMessage('receipt-handle-456')).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      loggerErrorSpy.mockRestore();
    });
  });

  describe('getQueueDepth()', () => {
    it('returns visible, invisible, and delayed message counts', async () => {
      mockSend.mockResolvedValue({
        Attributes: {
          ApproximateNumberOfMessages: '42',
          ApproximateNumberOfMessagesNotVisible: '5',
          ApproximateNumberOfMessagesDelayed: '3',
        },
      });

      const result = await service.getQueueDepth();

      expect(result).toEqual({ visible: 42, invisible: 5, delayed: 3 });
      expect(mockGetQueueAttributesInputs).toHaveLength(1);

      const commandInput = mockGetQueueAttributesInputs[0] as {
        QueueUrl: string;
        AttributeNames: string[];
      };

      expect(commandInput.QueueUrl).toBe(mockQueueUrl);
      expect(commandInput.AttributeNames).toContain('ApproximateNumberOfMessages');
      expect(commandInput.AttributeNames).toContain('ApproximateNumberOfMessagesNotVisible');
      expect(commandInput.AttributeNames).toContain('ApproximateNumberOfMessagesDelayed');
    });

    it('returns zeros when attributes are missing', async () => {
      mockSend.mockResolvedValue({ Attributes: {} });

      const result = await service.getQueueDepth();

      expect(result).toEqual({ visible: 0, invisible: 0, delayed: 0 });
    });

    it('returns zeros and logs error when SQS fails', async () => {
      const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('SQS unavailable'));

      const result = await service.getQueueDepth();

      expect(result).toEqual({ visible: 0, invisible: 0, delayed: 0 });
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      loggerErrorSpy.mockRestore();
    });
  });
});
