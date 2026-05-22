import type { HookMateEndpoint } from '@hookmate/shared';
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EndpointsService } from '../endpoints/endpoints.service';
import type { CreateEventInput } from '../events/events.service';
import { EventsService } from '../events/events.service';
import type { IngestionMessage } from '../sqs/sqs.service';
import { SqsService } from '../sqs/sqs.service';
import { IngestionService } from './ingestion.service';

function createMockEndpoint(overrides: Partial<HookMateEndpoint> = {}): HookMateEndpoint {
  return {
    id: 'ep-01JHQ',
    name: 'Test endpoint',
    destinationUrl: 'https://example.com/webhook',
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

describe('IngestionService', () => {
  let service: IngestionService;
  let mockEndpointsService: {
    getById: ReturnType<typeof vi.fn>;
  };
  let mockEventsService: {
    create: ReturnType<typeof vi.fn>;
  };
  let mockSqsService: {
    publish: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockEndpointsService = {
      getById: vi.fn(),
    };
    mockEventsService = {
      create: vi.fn(),
    };
    mockSqsService = {
      publish: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: EndpointsService, useValue: mockEndpointsService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: SqsService, useValue: mockSqsService },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  describe('ingest()', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'test' }));
    const headers = { 'content-type': 'application/json' };
    const sourceIp = '192.168.1.1';

    it('returns event_id, trace_id, and received_at for a valid request', async () => {
      const endpoint = createMockEndpoint();
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockEventsService.create.mockResolvedValue({
        id: 'evt-01JHQ',
        endpointId: endpoint.id,
        payload: { event: 'test' },
        status: 'received',
        traceId: 'trace-ulid-001',
        receivedAt: '2026-01-15T12:00:05Z',
      });

      const result = await service.ingest({ endpointId: endpoint.id, rawBody, headers, sourceIp });

      expect(result).toMatchObject({
        event_id: expect.any(String),
        trace_id: expect.any(String),
        received_at: expect.any(String),
      });
      expect(mockEndpointsService.getById).toHaveBeenCalledWith(endpoint.id);
      expect(mockEventsService.create).toHaveBeenCalledTimes(1);
      expect(mockSqsService.publish).toHaveBeenCalledTimes(1);
    });

    it('creates the event with the correct fields', async () => {
      const endpoint = createMockEndpoint();
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockEventsService.create.mockResolvedValue({
        id: 'evt-01JHQ',
        endpointId: endpoint.id,
        payload: { event: 'test' },
        status: 'received',
        traceId: 'trace-ulid-001',
        receivedAt: '2026-01-15T12:00:05Z',
      });

      await service.ingest({ endpointId: endpoint.id, rawBody, headers, sourceIp });

      const createCallArgs = mockEventsService.create.mock.calls[0]?.[0] as CreateEventInput;

      expect(createCallArgs.endpointId).toBe(endpoint.id);
      expect(createCallArgs.payload).toEqual({ event: 'test' });
      expect(createCallArgs.headers).toEqual(headers);
      expect(createCallArgs.sourceIp).toBe(sourceIp);
      expect(createCallArgs.status).toBe('received');
    });

    it('publishes an SQS message with the correct fields', async () => {
      const endpoint = createMockEndpoint();
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockEventsService.create.mockResolvedValue({
        id: 'evt-01JHQ',
        endpointId: endpoint.id,
        payload: { event: 'test' },
        status: 'received',
        traceId: 'trace-ulid-001',
        receivedAt: '2026-01-15T12:00:05Z',
      });

      await service.ingest({ endpointId: endpoint.id, rawBody, headers, sourceIp });

      const publishArgs = mockSqsService.publish.mock.calls[0]?.[0] as IngestionMessage;

      expect(publishArgs.event_id).toBe('evt-01JHQ');
      expect(publishArgs.endpoint_id).toBe(endpoint.id);
      expect(publishArgs.trace_id).toBeDefined();
      expect(publishArgs.received_at).toBeDefined();
    });

    it('throws NotFoundException when endpoint does not exist', async () => {
      mockEndpointsService.getById.mockRejectedValue(new NotFoundException());

      await expect(
        service.ingest({ endpointId: 'nonexistent', rawBody, headers, sourceIp }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when HMAC signature is invalid', async () => {
      const endpoint = createMockEndpoint({ secret: 'whsec_test' });
      mockEndpointsService.getById.mockResolvedValue(endpoint);

      await expect(
        service.ingest({
          endpointId: endpoint.id,
          rawBody,
          headers,
          sourceIp,
          signature: 'sha256=invalid_signature_value',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with code invalid_signature', async () => {
      const endpoint = createMockEndpoint({ secret: 'whsec_test' });
      mockEndpointsService.getById.mockResolvedValue(endpoint);

      await expect(
        service.ingest({
          endpointId: endpoint.id,
          rawBody,
          headers,
          sourceIp,
          signature: 'sha256=bad',
        }),
      ).rejects.toThrow('invalid_signature');
    });

    it('throws ConflictException when endpoint is paused', async () => {
      const endpoint = createMockEndpoint({ status: 'paused' });
      mockEndpointsService.getById.mockResolvedValue(endpoint);

      await expect(
        service.ingest({ endpointId: endpoint.id, rawBody, headers, sourceIp }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ServiceUnavailableException when event persistence fails', async () => {
      const endpoint = createMockEndpoint();
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockEventsService.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.ingest({ endpointId: endpoint.id, rawBody, headers, sourceIp }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('logs error but does not throw when SQS publish fails', async () => {
      const endpoint = createMockEndpoint();
      mockEndpointsService.getById.mockResolvedValue(endpoint);
      mockEventsService.create.mockResolvedValue({
        id: 'evt-01JHQ',
        endpointId: endpoint.id,
        payload: { event: 'test' },
        status: 'received',
        traceId: 'trace-ulid-001',
        receivedAt: '2026-01-15T12:00:05Z',
      });
      mockSqsService.publish.mockRejectedValue(new Error('SQS unavailable'));

      const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      const result = await service.ingest({
        endpointId: endpoint.id,
        rawBody,
        headers,
        sourceIp,
      });

      expect(result).toMatchObject({
        event_id: expect.any(String),
        trace_id: expect.any(String),
        received_at: expect.any(String),
      });
      expect(loggerErrorSpy).toHaveBeenCalled();
      loggerErrorSpy.mockRestore();
    });
  });
});
