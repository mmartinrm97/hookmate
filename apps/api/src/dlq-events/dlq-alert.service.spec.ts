import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DlqAlertService } from './dlq-alert.service';

const mockSend = vi.fn();
const mockPublishInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn(() => ({ send: mockSend })),
  PublishCommand: class MockPublishCommand {
    constructor(input: Record<string, unknown>) {
      mockPublishInputs.push(input);
    }
  },
}));

describe('DlqAlertService', () => {
  let service: DlqAlertService;
  const mockTopicArn = 'arn:aws:sns:us-east-1:123456789012:dlq-alarms';

  beforeEach(async () => {
    mockSend.mockReset();
    mockPublishInputs.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqAlertService,
        {
          provide: 'SNS_CLIENT',
          useValue: { send: mockSend },
        },
        {
          provide: 'SNS_ALARM_TOPIC_ARN',
          useValue: mockTopicArn,
        },
      ],
    }).compile();

    service = module.get<DlqAlertService>(DlqAlertService);
  });

  describe('publishThresholdAlert()', () => {
    it('publishes a message to the SNS topic when depth > threshold', async () => {
      mockSend.mockResolvedValue({ MessageId: 'sns-msg-001' });

      await service.publishThresholdAlert('ep-01JHQ', 150, 100);

      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandInput = mockPublishInputs[0] as {
        TopicArn: string;
        Subject: string;
        Message: string;
        MessageAttributes: Record<string, unknown>;
      };

      expect(commandInput).toBeDefined();
      expect(commandInput.TopicArn).toBe(mockTopicArn);
      expect(commandInput.Subject).toContain('ep-01JHQ');

      const parsedMessage = JSON.parse(commandInput.Message) as Record<string, unknown>;

      expect(parsedMessage).toMatchObject({
        endpointId: 'ep-01JHQ',
        depth: 150,
        threshold: 100,
      });

      expect(commandInput.MessageAttributes).toMatchObject({
        endpoint_id: { DataType: 'String', StringValue: 'ep-01JHQ' },
        depth: { DataType: 'Number', StringValue: '150' },
        threshold: { DataType: 'Number', StringValue: '100' },
      });
    });

    it('logs warning when topic ARN is not configured', async () => {
      const loggerWarnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      const moduleNoArn: TestingModule = await Test.createTestingModule({
        providers: [
          DlqAlertService,
          { provide: 'SNS_CLIENT', useValue: { send: mockSend } },
          { provide: 'SNS_ALARM_TOPIC_ARN', useValue: '' },
        ],
      }).compile();

      const serviceNoArn = moduleNoArn.get<DlqAlertService>(DlqAlertService);

      await serviceNoArn.publishThresholdAlert('ep-01JHQ', 150, 100);

      expect(mockSend).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SNS_ALARM_TOPIC_ARN is not configured'),
      );

      loggerWarnSpy.mockRestore();
    });

    it('logs error and does not throw when SNS publish fails', async () => {
      const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('SNS throttling'));

      await expect(service.publishThresholdAlert('ep-01JHQ', 150, 100)).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish DLQ threshold alert'),
        expect.any(String),
      );

      loggerErrorSpy.mockRestore();
    });

    it('includes endpointId, depth, and threshold in the alert message body', async () => {
      mockSend.mockResolvedValue({ MessageId: 'sns-msg-002' });

      await service.publishThresholdAlert('ep-02ABC', 5, 3);

      const commandInput = mockPublishInputs[0] as { Message: string };
      const parsedMessage = JSON.parse(commandInput.Message) as Record<string, unknown>;

      expect(parsedMessage).toMatchObject({
        endpointId: 'ep-02ABC',
        depth: 5,
        threshold: 3,
      });
      expect(typeof parsedMessage.message).toBe('string');
      expect(parsedMessage.message as string).toContain('exceeds');
    });

    it('sets the subject with endpoint ID', async () => {
      mockSend.mockResolvedValue({ MessageId: 'sns-msg-003' });

      await service.publishThresholdAlert('ep-custom', 200, 100);

      const commandInput = mockPublishInputs[0] as { Subject: string };

      expect(commandInput.Subject).toBe('DLQ Alert — Endpoint ep-custom');
    });
  });
});
