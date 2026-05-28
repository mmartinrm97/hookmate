import type {
  HookMateDeliveryAttempt,
  HookMateEndpoint,
  HookMateEvent,
  HookMateRoutingRule,
} from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CIRCUIT_BREAKER } from '../circuit-breaker/circuit-breaker.types';
import { DeliveryAttemptsService } from '../delivery-attempts/delivery-attempts.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { EventsService } from '../events/events.service';
import { RoutingRulesService } from '../routing-rules/routing-rules.service';
import { DeliveryService } from './delivery.service';
import { DlqPromoterService } from './dlq-promoter.service';
import { RoutingEvaluatorService } from './routing-evaluator.service';
import { ProcessorService } from './processor.service';
import type { DeliveryResult, ProcessInput } from './processor.types';

function createMockEvent(overrides: Partial<HookMateEvent> = {}): HookMateEvent {
  return {
    id: 'evt-01JHQ',
    endpointId: 'ep-01JHQ',
    payload: { message: 'test' },
    headers: { 'content-type': 'application/json' },
    sourceIp: '192.168.1.1',
    status: 'received',
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
    cbFailureThreshold: 0.8,
    cbWindowSeconds: 300,
    cbCooldownSeconds: 120,
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-01-15T12:00:00Z',
    ...overrides,
  };
}

function makeInput(overrides: Partial<ProcessInput> = {}): ProcessInput {
  return {
    event_id: 'evt-01JHQ',
    endpoint_id: 'ep-01JHQ',
    attempt_number: 0,
    ...overrides,
  };
}

function makeDeliveryResult(overrides: Partial<DeliveryResult> = {}): DeliveryResult {
  return {
    status: 'success',
    httpStatus: 200,
    latencyMs: 100,
    responseBody: null,
    ...overrides,
  };
}

describe('ProcessorService', () => {
  let service: ProcessorService;
  let mockEventsService: {
    getById: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let mockEndpointsService: {
    getById: ReturnType<typeof vi.fn>;
  };
  let mockRoutingRulesService: {
    getByEndpointId: ReturnType<typeof vi.fn>;
  };
  let mockDeliveryAttemptsService: {
    create: ReturnType<typeof vi.fn>;
  };
  let mockDeliveryService: {
    deliver: ReturnType<typeof vi.fn>;
  };
  let mockQueue: {
    add: ReturnType<typeof vi.fn>;
  };
  let mockDlqPromoterService: {
    promote: ReturnType<typeof vi.fn>;
  };
  let mockCircuitBreaker: {
    checkState: ReturnType<typeof vi.fn>;
    recordSuccess: ReturnType<typeof vi.fn>;
    recordFailure: ReturnType<typeof vi.fn>;
  };

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
    mockDlqPromoterService = {
      promote: vi.fn(),
    };
    mockCircuitBreaker = {
      checkState: vi.fn().mockResolvedValue({ state: 'closed' as const, canProceed: true }),
      recordSuccess: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessorService,
        RoutingEvaluatorService,
        { provide: EventsService, useValue: mockEventsService },
        { provide: EndpointsService, useValue: mockEndpointsService },
        { provide: RoutingRulesService, useValue: mockRoutingRulesService },
        { provide: DeliveryAttemptsService, useValue: mockDeliveryAttemptsService },
        { provide: DeliveryService, useValue: mockDeliveryService },
        { provide: getQueueToken('retries'), useValue: mockQueue },
        { provide: DlqPromoterService, useValue: mockDlqPromoterService },
        { provide: CIRCUIT_BREAKER, useValue: mockCircuitBreaker },
      ],
    }).compile();

    service = module.get<ProcessorService>(ProcessorService);
  });

  describe('process()', () => {
    describe('happy path — successful delivery', () => {
      it('returns delivered status when delivery succeeds', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint();
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(makeDeliveryResult());
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockEventsService.updateStatus.mockResolvedValue({ ...event, status: 'delivered' });

        const result = await service.process(makeInput());

        expect(result.status).toBe('delivered');
        expect(result.eventId).toBe('evt-01JHQ');
        expect(mockEventsService.updateStatus).toHaveBeenCalledWith('evt-01JHQ', 'delivered');
      });

      it('records a delivery attempt with correct fields', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint();
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            httpStatus: 200,
            latencyMs: 150,
            responseBody: '{"ok":true}',
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput());

        expect(mockDeliveryAttemptsService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: 'evt-01JHQ',
            attemptNumber: 0,
            destinationUrl: 'https://example.com/hook',
            httpStatus: 200,
            latencyMs: 150,
            responseBody: '{"ok":true}',
            status: 'success',
          }),
        );
      });
    });

    describe('endpoint paused — skip', () => {
      it('returns skipped when endpoint is paused', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint({ status: 'paused' });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);

        const result = await service.process(makeInput());

        expect(result.status).toBe('skipped');
        expect(mockDeliveryService.deliver).not.toHaveBeenCalled();
      });
    });

    describe('missing event — handled gracefully', () => {
      it('returns error result when event is not found', async () => {
        mockEventsService.getById.mockRejectedValue(new NotFoundException('Event not found'));
        mockEndpointsService.getById.mockResolvedValue(createMockEndpoint());

        const result = await service.process(makeInput());

        expect(result.status).toBe('skipped');
        expect(mockDeliveryService.deliver).not.toHaveBeenCalled();
      });

      it('returns error result when endpoint is not found', async () => {
        mockEventsService.getById.mockResolvedValue(createMockEvent());
        mockEndpointsService.getById.mockRejectedValue(new NotFoundException('Endpoint not found'));

        const result = await service.process(makeInput());

        expect(result.status).toBe('skipped');
        expect(mockDeliveryService.deliver).not.toHaveBeenCalled();
      });
    });

    describe('failed delivery — retry scheduling', () => {
      it('schedules a BullMQ retry job when delivery fails before max retries', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint({ maxRetries: 5, retryBaseDelayMs: 5000 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'failed',
            httpStatus: 503,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockQueue.add.mockResolvedValue({ id: 'retry-job-1' });
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        const result = await service.process(makeInput({ attempt_number: 2 }));

        expect(result.status).toBe('failed_retry');
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-retry',
          {
            event_id: 'evt-01JHQ',
            endpoint_id: 'ep-01JHQ',
            attempt_number: 3,
          },
          expect.objectContaining({
            delay: expect.any(Number),
          }),
        );
      });

      it('calculates delay as base × 2^attempt capped at 1 hour', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint({ retryBaseDelayMs: 5000 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'failed',
            httpStatus: 503,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockQueue.add.mockResolvedValue({ id: 'retry-job-1' });
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput({ attempt_number: 2 }));

        // base 5000 × 2^2 = 20000
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-retry',
          expect.any(Object),
          expect.objectContaining({ delay: 20000 }),
        );
      });

      it('caps delay at 3600000ms (1 hour)', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint({ retryBaseDelayMs: 5000, maxRetries: 999 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'failed',
            httpStatus: 503,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockQueue.add.mockResolvedValue({ id: 'retry-job-1' });
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput({ attempt_number: 100 }));

        // 5000 × 2^100 would overflow, but cap at 3600000
        const addCall = mockQueue.add.mock.calls[0] as
          | [string, unknown, { delay: number }]
          | undefined;
        const delay = addCall?.[2]?.delay;
        expect(delay).toBe(3600000);
      });

      it('updates event status to failed on retry', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint({ maxRetries: 5 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'failed',
            httpStatus: 503,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockQueue.add.mockResolvedValue({ id: 'retry-job-1' });
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput({ attempt_number: 1 }));

        expect(mockEventsService.updateStatus).toHaveBeenCalledWith('evt-01JHQ', 'failed');
      });
    });

    describe('max retries exhausted — DLQ promotion', () => {
      it('promotes to DLQ when attempt_number >= maxRetries', async () => {
        const event = createMockEvent({ status: 'failed' });
        const endpoint = createMockEndpoint({ maxRetries: 3 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'failed',
            httpStatus: 503,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        const result = await service.process(makeInput({ attempt_number: 3 }));

        expect(result.status).toBe('dead_lettered');
        expect(mockDlqPromoterService.promote).toHaveBeenCalled();
      });

      it('passes failure reason based on last delivery result', async () => {
        const event = createMockEvent({ status: 'failed' });
        const endpoint = createMockEndpoint({ maxRetries: 1 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'failed',
            httpStatus: 504,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput({ attempt_number: 1 }));

        expect(mockDlqPromoterService.promote).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.any(Array),
          'HTTP 504 Gateway Timeout',
        );
      });

      it('does not schedule a retry when promoting to DLQ', async () => {
        const event = createMockEvent({ status: 'failed' });
        const endpoint = createMockEndpoint({ maxRetries: 2 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'failed',
            httpStatus: 502,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput({ attempt_number: 2 }));

        expect(mockQueue.add).not.toHaveBeenCalled();
        expect(mockDlqPromoterService.promote).toHaveBeenCalledTimes(1);
      });
    });

    describe('routing evaluation', () => {
      it('uses default endpoint destinationUrl when no rules exist', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint({ destinationUrl: 'https://default.example.com/hook' });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(makeDeliveryResult());
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput());

        expect(mockDeliveryService.deliver).toHaveBeenCalledWith(
          'https://default.example.com/hook',
          expect.any(Object),
          expect.any(String),
        );
      });

      it('uses routing rule destinationUrl when rules match', async () => {
        const event = createMockEvent({
          headers: { 'X-Event-Type': 'payment.completed' },
        });
        const endpoint = createMockEndpoint({ destinationUrl: 'https://default.example.com/hook' });
        const rules: HookMateRoutingRule[] = [
          {
            id: 1,
            endpointId: 'ep-01JHQ',
            priority: 10,
            matchType: 'header',
            matchKey: 'X-Event-Type',
            matchValue: 'payment.completed',
            destinationType: 'http',
            destinationUrl: 'https://payments.example.com/hook',
            createdAt: '2026-01-15T12:00:00Z',
          },
        ];
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue(rules);
        mockDeliveryService.deliver.mockResolvedValue(makeDeliveryResult());
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        await service.process(makeInput());

        expect(mockDeliveryService.deliver).toHaveBeenCalledWith(
          'https://payments.example.com/hook',
          expect.any(Object),
          expect.any(String),
        );
      });
    });

    describe('delivery result handling', () => {
      it('returns failed_retry on timeout before max retries', async () => {
        const event = createMockEvent();
        const endpoint = createMockEndpoint({ maxRetries: 5 });
        mockEventsService.getById.mockResolvedValue(event);
        mockEndpointsService.getById.mockResolvedValue(endpoint);
        mockRoutingRulesService.getByEndpointId.mockResolvedValue([]);
        mockDeliveryService.deliver.mockResolvedValue(
          makeDeliveryResult({
            status: 'timeout',
            httpStatus: null,
          }),
        );
        mockDeliveryAttemptsService.create.mockResolvedValue({} as HookMateDeliveryAttempt);
        mockQueue.add.mockResolvedValue({ id: 'job-1' });
        mockEventsService.updateStatus.mockResolvedValue({} as HookMateEvent);

        const result = await service.process(makeInput({ attempt_number: 1 }));

        expect(result.status).toBe('failed_retry');
      });
    });
  });
});
