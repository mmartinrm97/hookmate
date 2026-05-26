import type {
  HookMateDeliveryAttempt,
  HookMateEndpoint,
  HookMateEvent,
  HookMateDlqEvent,
} from '@hookmate/shared';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DlqAlertService } from '../dlq-events/dlq-alert.service';
import { DlqEventsService } from '../dlq-events/dlq-events.service';
import { EventsService } from '../events/events.service';
import { DlqPromoterService } from './dlq-promoter.service';

function createMockEvent(overrides: Partial<HookMateEvent> = {}): HookMateEvent {
  return {
    id: 'evt-01JHQ',
    endpointId: 'ep-01JHQ',
    payload: { message: 'test' },
    headers: { 'content-type': 'application/json' },
    sourceIp: '192.168.1.1',
    status: 'failed',
    category: null,
    traceId: 'trace-abc-123',
    receivedAt: '2026-01-15T12:00:00Z',
    deliveredAt: null,
    ...overrides,
  };
}

function createMockEndpoint(overrides: Partial<HookMateEndpoint> = {}): HookMateEndpoint {
  return {
    id: 'ep-01JHQ',
    name: 'Test endpoint',
    destinationUrl: 'https://example.com/hook',
    status: 'active',
    secret: undefined,
    maxRetries: 5,
    retryBaseDelayMs: 5000,
    dlqThreshold: 100,
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-01-15T12:00:00Z',
    ...overrides,
  };
}

function createMockAttempt(
  overrides: Partial<HookMateDeliveryAttempt> = {},
): HookMateDeliveryAttempt {
  return {
    id: 1,
    eventId: 'evt-01JHQ',
    attemptNumber: 1,
    destinationUrl: 'https://example.com/hook',
    httpStatus: 503,
    responseBody: null,
    latencyMs: 1000,
    status: 'failed',
    attemptedAt: '2026-01-15T12:00:05Z',
    ...overrides,
  };
}

describe('DlqPromoterService', () => {
  let service: DlqPromoterService;
  let mockDlqEventsService: {
    create: ReturnType<typeof vi.fn>;
    countByEndpointId: ReturnType<typeof vi.fn>;
  };
  let mockEventsService: {
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let mockDlqAlertService: {
    publishThresholdAlert: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDlqEventsService = {
      create: vi.fn(),
      countByEndpointId: vi.fn(),
    };
    mockEventsService = {
      updateStatus: vi.fn(),
    };
    mockDlqAlertService = {
      publishThresholdAlert: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqPromoterService,
        { provide: DlqEventsService, useValue: mockDlqEventsService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: DlqAlertService, useValue: mockDlqAlertService },
      ],
    }).compile();

    service = module.get<DlqPromoterService>(DlqPromoterService);
  });

  describe('promote()', () => {
    it('calls DlqEventsService.create with event context', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({
        id: 'dlq-01JHQ',
        eventId: event.id,
        endpointId: endpoint.id,
        failureReason: 'Max retries exhausted',
        attemptsJson: attempts,
        endpointSnapshot: { ...endpoint },
        createdAt: '2026-01-15T12:00:10Z',
        retriedAt: null,
      } satisfies HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({ ...event, status: 'dead_lettered' });

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqEventsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: event.id,
          endpointId: endpoint.id,
          failureReason: 'Max retries exhausted',
          attemptsJson: attempts,
        }),
      );
    });

    it('calls DlqEventsService.create with endpoint snapshot', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqEventsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endpointSnapshot: {
            id: endpoint.id,
            name: endpoint.name,
            destinationUrl: endpoint.destinationUrl,
          },
        }),
      );
    });

    it('updates event status to dead_lettered', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockEventsService.updateStatus).toHaveBeenCalledWith(event.id, 'dead_lettered');
    });

    it('calls DlqEventsService.create before updating event status', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      const createCallOrder = mockDlqEventsService.create.mock.invocationCallOrder[0];
      const updateCallOrder = mockEventsService.updateStatus.mock.invocationCallOrder[0];
      expect(createCallOrder).toBeLessThan(updateCallOrder);
    });

    it('passes failure reason correctly', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [createMockAttempt({ httpStatus: 502 })];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await service.promote(event, endpoint, attempts, 'HTTP 502 Bad Gateway');

      expect(mockDlqEventsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: 'HTTP 502 Bad Gateway',
        }),
      );
    });

    it('handles empty attempts array', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts: HookMateDeliveryAttempt[] = [];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqEventsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptsJson: [],
        }),
      );
    });

    it('includes multiple attempts in the snapshot', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [
        createMockAttempt({ id: 1, attemptNumber: 1, httpStatus: 503 }),
        createMockAttempt({ id: 2, attemptNumber: 2, httpStatus: 504 }),
        createMockAttempt({ id: 3, attemptNumber: 3, httpStatus: 502 }),
      ];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqEventsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptsJson: attempts,
        }),
      );
    });

    it('does not throw when DlqEventsService.create fails', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockRejectedValue(new Error('DB error'));
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await expect(
        service.promote(event, endpoint, attempts, 'Max retries exhausted'),
      ).resolves.not.toThrow();
    });

    it('still updates event status even if DlqEventsService.create fails', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockRejectedValue(new Error('DB error'));
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockEventsService.updateStatus).toHaveBeenCalledWith(event.id, 'dead_lettered');
    });
  });

  describe('threshold alert integration', () => {
    it('checks DLQ depth after promoting an event', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ id: 'ep-threshold', dlqThreshold: 100 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockResolvedValue(50);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqEventsService.countByEndpointId).toHaveBeenCalledWith('ep-threshold');
    });

    it('publishes threshold alert when depth exceeds threshold', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ id: 'ep-over', dlqThreshold: 10 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockResolvedValue(15);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqAlertService.publishThresholdAlert).toHaveBeenCalledWith('ep-over', 15, 10);
    });

    it('does NOT publish alert when depth equals threshold', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ id: 'ep-equal', dlqThreshold: 10 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockResolvedValue(10);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqAlertService.publishThresholdAlert).not.toHaveBeenCalled();
    });

    it('does NOT publish alert when depth is below threshold', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ id: 'ep-below', dlqThreshold: 100 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockResolvedValue(5);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqAlertService.publishThresholdAlert).not.toHaveBeenCalled();
    });

    it('does not throw when countByEndpointId fails', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ dlqThreshold: 100 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockRejectedValue(new Error('DB timeout'));

      await expect(
        service.promote(event, endpoint, attempts, 'Max retries exhausted'),
      ).resolves.not.toThrow();
    });

    it('does not throw when publishThresholdAlert fails', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ id: 'ep-fail-alert', dlqThreshold: 10 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockResolvedValue(20);
      mockDlqAlertService.publishThresholdAlert.mockRejectedValue(new Error('SNS error'));

      await expect(
        service.promote(event, endpoint, attempts, 'Max retries exhausted'),
      ).resolves.not.toThrow();
    });

    it('uses default threshold of 100 when endpoint does not specify one', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ id: 'ep-default', dlqThreshold: 100 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockResolvedValue(150);

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(mockDlqAlertService.publishThresholdAlert).toHaveBeenCalledWith(
        'ep-default',
        150,
        100,
      );
    });

    it('logs error and continues when DLQ depth check fails', async () => {
      const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ dlqThreshold: 100 });
      const attempts = [createMockAttempt()];
      mockDlqEventsService.create.mockResolvedValue({} as HookMateDlqEvent);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.countByEndpointId.mockRejectedValue(new Error('DB connection lost'));

      await service.promote(event, endpoint, attempts, 'Max retries exhausted');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check DLQ threshold'),
        expect.any(String),
      );
      loggerErrorSpy.mockRestore();
    });
  });
});
