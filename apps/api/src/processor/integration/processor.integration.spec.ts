import type { HookMateDeliveryAttempt, HookMateEndpoint, HookMateEvent } from '@hookmate/shared';
import { getQueueToken } from '@nestjs/bull';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CIRCUIT_BREAKER } from '../../circuit-breaker/circuit-breaker.types';
import { DeliveryAttemptsService } from '../../delivery-attempts/delivery-attempts.service';
import { DlqAlertService } from '../../dlq-events/dlq-alert.service';
import { DlqEventsService } from '../../dlq-events/dlq-events.service';
import { EndpointsService } from '../../endpoints/endpoints.service';
import { EventsService } from '../../events/events.service';
import { RoutingRulesService } from '../../routing-rules/routing-rules.service';
import type { SqsReceivedMessage } from '../../sqs/sqs.service';
import { SqsService } from '../../sqs/sqs.service';
import { ConfigService } from '@nestjs/config';
import { DeliveryService } from '../delivery.service';
import { DlqPromoterService } from '../dlq-promoter.service';
import { ProcessorService } from '../processor.service';
import type { DeliveryResult, ProcessInput } from '../processor.types';
import { RoutingEvaluatorService } from '../routing-evaluator.service';
import { SqsConsumerService } from '../sqs-consumer.service';

function createMockEvent(overrides: Partial<HookMateEvent> = {}): HookMateEvent {
  return {
    id: 'evt-int-001',
    endpointId: 'ep-int-001',
    payload: { message: 'integration-test' },
    headers: { 'X-Event-Type': 'test.event' },
    sourceIp: '10.0.0.1',
    status: 'received',
    category: null,
    traceId: 'trace-int-001',
    receivedAt: '2026-01-15T12:00:00Z',
    deliveredAt: null,
    ...overrides,
  };
}

function createMockEndpoint(overrides: Partial<HookMateEndpoint> = {}): HookMateEndpoint {
  return {
    id: 'ep-int-001',
    name: 'Integration test endpoint',
    destinationUrl: 'https://example.com/webhook',
    status: 'active',
    secret: undefined,
    maxRetries: 3,
    retryBaseDelayMs: 5000,
    dlqThreshold: 100,
    cbFailureThreshold: 0.8,
    cbWindowSeconds: 300,
    cbCooldownSeconds: 120,
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-01-15T12:00:00Z',
    ...overrides,
  };
}

describe('Processor Integration Tests', () => {
  let processorService: ProcessorService;
  let sqsConsumerService: SqsConsumerService;
  let mockEventsService: Record<string, ReturnType<typeof vi.fn>>;
  let mockEndpointsService: Record<string, ReturnType<typeof vi.fn>>;
  let mockRoutingRulesService: Record<string, ReturnType<typeof vi.fn>>;
  let mockDeliveryAttemptsService: Record<string, ReturnType<typeof vi.fn>>;
  let mockDeliveryService: Record<string, ReturnType<typeof vi.fn>>;
  let mockQueue: Record<string, ReturnType<typeof vi.fn>>;
  let mockDlqEventsService: Record<string, ReturnType<typeof vi.fn>>;
  let mockSqsService: Record<string, ReturnType<typeof vi.fn>>;
  let mockConfigService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockEventsService = {
      getById: vi.fn(),
      updateStatus: vi.fn(),
    };
    mockEndpointsService = {
      getById: vi.fn(),
    };
    mockRoutingRulesService = {
      getByEndpointId: vi.fn(),
    };
    mockDeliveryAttemptsService = {
      create: vi.fn(),
    };
    mockDeliveryService = {
      deliver: vi.fn(),
    };
    mockQueue = {
      add: vi.fn(),
    };
    mockDlqEventsService = {
      create: vi.fn(),
    };
    mockSqsService = {
      receiveMessage: vi.fn(),
      deleteMessage: vi.fn(),
    };
    mockConfigService = {
      get: vi.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessorService,
        RoutingEvaluatorService,
        DeliveryService,
        DlqPromoterService,
        SqsConsumerService,
        { provide: EventsService, useValue: mockEventsService },
        { provide: EndpointsService, useValue: mockEndpointsService },
        { provide: RoutingRulesService, useValue: mockRoutingRulesService },
        { provide: DeliveryAttemptsService, useValue: mockDeliveryAttemptsService },
        { provide: DeliveryService, useValue: mockDeliveryService },
        { provide: getQueueToken('retries'), useValue: mockQueue },
        { provide: DlqEventsService, useValue: mockDlqEventsService },
        { provide: DlqAlertService, useValue: { publishThresholdAlert: vi.fn() } },
        { provide: SqsService, useValue: mockSqsService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: CIRCUIT_BREAKER,
          useValue: {
            checkState: vi.fn().mockResolvedValue({ state: 'closed' as const, canProceed: true }),
            recordSuccess: vi.fn().mockResolvedValue(undefined),
            recordFailure: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    processorService = module.get<ProcessorService>(ProcessorService);
    sqsConsumerService = module.get<SqsConsumerService>(SqsConsumerService);
  });

  describe('Full pipeline: received → delivered (happy path)', () => {
    it('completes the full process pipeline with delivered status', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint();
      const deliveryResult: DeliveryResult = {
        status: 'success',
        httpStatus: 200,
        latencyMs: 45,
        responseBody: '{"ok":true}',
      };

      mockEventsService.getById.mockResolvedValue(event);
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
      mockDeliveryService.deliver.mockResolvedValue(deliveryResult);
      mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
      mockEventsService.updateStatus.mockResolvedValue({ ...event, status: 'delivered' });

      const input: ProcessInput = {
        event_id: 'evt-int-001',
        endpoint_id: 'ep-int-001',
        attempt_number: 0,
      };

      const result = await processorService.process(input);

      // Assert: pipeline completed
      expect(result.status).toBe('delivered');
      expect(result.eventId).toBe('evt-int-001');

      // Assert: all services were called in order
      expect(mockEventsService.getById).toHaveBeenCalledWith('evt-int-001');
      expect(mockEndpointsService.getById).toHaveBeenCalledWith('ep-int-001');
      expect(mockRoutingRulesService.getByEndpointId).toHaveBeenCalledWith('ep-int-001');
      expect(mockDeliveryService.deliver).toHaveBeenCalledWith(
        'https://example.com/webhook',
        { message: 'integration-test' },
        'evt-int-001',
      );
      expect(mockDeliveryAttemptsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-int-001',
          attemptNumber: 0,
          httpStatus: 200,
          status: 'success',
        }),
      );
      expect(mockEventsService.updateStatus).toHaveBeenCalledWith('evt-int-001', 'delivered');
    });
  });

  describe('Full pipeline: received → failed → DLQ', () => {
    it('promotes to DLQ when max retries exhausted', async () => {
      const event = createMockEvent({ status: 'failed' });
      const endpoint = createMockEndpoint({ maxRetries: 2 });
      const failedResult: DeliveryResult = {
        status: 'failed',
        httpStatus: 503,
        latencyMs: 5000,
        responseBody: null,
      };

      mockEventsService.getById.mockResolvedValue(event);
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
      mockDeliveryService.deliver.mockResolvedValue(failedResult);
      mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockDlqEventsService.create.mockResolvedValue({} as HookMateEvent);

      const input: ProcessInput = {
        event_id: 'evt-int-001',
        endpoint_id: 'ep-int-001',
        attempt_number: 2,
      };

      const result = await processorService.process(input);

      // Assert: event was dead-lettered
      expect(result.status).toBe('dead_lettered');

      // Assert: DLQ service was called
      expect(mockDlqEventsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-int-001',
          endpointId: 'ep-int-001',
          failureReason: 'HTTP 503 Service Unavailable',
        }),
      );

      // Assert: event status updated
      expect(mockEventsService.updateStatus).toHaveBeenCalledWith('evt-int-001', 'dead_lettered');

      // Assert: no retry scheduled
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('Full pipeline: received → failed → retry scheduled', () => {
    it('schedules retry with correct exponential backoff', async () => {
      const event = createMockEvent();
      const endpoint = createMockEndpoint({ maxRetries: 5, retryBaseDelayMs: 2000 });
      const failedResult: DeliveryResult = {
        status: 'failed',
        httpStatus: 502,
        latencyMs: 3000,
        responseBody: null,
      };

      mockEventsService.getById.mockResolvedValue(event);
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
      mockDeliveryService.deliver.mockResolvedValue(failedResult);
      mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);
      mockQueue.add.mockResolvedValue({ id: 'retry-job-1' });

      const input: ProcessInput = {
        event_id: 'evt-int-001',
        endpoint_id: 'ep-int-001',
        attempt_number: 1,
      };

      const result = await processorService.process(input);

      // Assert: retry was scheduled
      expect(result.status).toBe('failed_retry');

      // Assert: retry delay = 2000 × 2^1 = 4000ms
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-retry',
        {
          event_id: 'evt-int-001',
          endpoint_id: 'ep-int-001',
          attempt_number: 2,
        },
        expect.objectContaining({ delay: 4000 }),
      );
    });
  });

  describe('SQS Consumer integration', () => {
    it('polls, processes, and deletes SQS messages', async () => {
      const messages: SqsReceivedMessage[] = [
        {
          messageId: 'sqs-msg-1',
          receiptHandle: 'receipt-1',
          body: {
            event_id: 'evt-int-001',
            endpoint_id: 'ep-int-001',
            trace_id: 'trace-int-001',
            received_at: '2026-01-15T12:00:00Z',
          },
        },
      ];

      const event = createMockEvent();
      const endpoint = createMockEndpoint();

      mockSqsService.receiveMessage.mockResolvedValue(messages);
      mockEventsService.getById.mockResolvedValue(event);
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
      mockDeliveryService.deliver.mockResolvedValue({
        status: 'success',
        httpStatus: 200,
        latencyMs: 50,
        responseBody: null,
      } satisfies DeliveryResult);
      mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
      mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

      await sqsConsumerService.poll();

      // Assert: message was received and processed
      expect(mockSqsService.receiveMessage).toHaveBeenCalledWith(10, 5);
      expect(mockSqsService.deleteMessage).toHaveBeenCalledWith('receipt-1');
      expect(mockEventsService.getById).toHaveBeenCalledWith('evt-int-001');
    });
  });
});
