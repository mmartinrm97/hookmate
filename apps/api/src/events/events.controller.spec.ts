import 'reflect-metadata';
import type { PaginatedResponse } from '@hookmate/shared';
import type { HookMateDeliveryAttempt, HookMateEvent } from '@hookmate/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { DeliveryAttemptsService } from '../delivery-attempts/delivery-attempts.service';

describe('EventsController', () => {
  let controller: EventsController;
  let mockEventsService: {
    listFiltered: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let mockAttemptsService: {
    getByEventId: ReturnType<typeof vi.fn>;
  };

  const mockEvent: HookMateEvent = {
    id: '01JHQEVENT001',
    endpointId: 'ep-01JHQ',
    payload: { message: 'hello' },
    headers: { 'content-type': 'application/json' },
    sourceIp: '192.168.1.1',
    status: 'received',
    category: null,
    traceId: 'trace-abc',
    receivedAt: '2026-01-15T12:00:00.000Z',
    deliveredAt: null,
  };

  const mockAttempt: HookMateDeliveryAttempt = {
    id: 1,
    eventId: '01JHQEVENT001',
    attemptNumber: 1,
    destinationUrl: 'https://example.com/webhook',
    httpStatus: 200,
    responseBody: '{"ok":true}',
    latencyMs: 150,
    status: 'success',
    attemptedAt: '2026-01-15T12:00:05.000Z',
  };

  beforeEach(async () => {
    mockEventsService = {
      listFiltered: vi.fn(),
      getById: vi.fn(),
      list: vi.fn(),
    };
    mockAttemptsService = {
      getByEventId: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: mockEventsService },
        { provide: DeliveryAttemptsService, useValue: mockAttemptsService },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  describe('list()', () => {
    it('calls service.listFiltered with query params and returns paginated response', async () => {
      const paginated: PaginatedResponse<HookMateEvent> = {
        items: [mockEvent],
        total: 1,
        page: 1,
        limit: 50,
      };
      mockEventsService.listFiltered.mockResolvedValue(paginated);

      const result = await controller.list({
        endpointId: 'ep-01JHQ',
        page: 1,
        limit: 50,
      } as never);

      expect(result).toEqual(paginated);
      expect(mockEventsService.listFiltered).toHaveBeenCalledWith({
        endpointId: 'ep-01JHQ',
        page: 1,
        limit: 50,
      });
    });

    it('uses defaults when no query params provided', async () => {
      const paginated: PaginatedResponse<HookMateEvent> = {
        items: [],
        total: 0,
        page: 1,
        limit: 50,
      };
      mockEventsService.listFiltered.mockResolvedValue(paginated);

      const result = await controller.list({} as never);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(mockEventsService.listFiltered).toHaveBeenCalledWith({});
    });
  });

  describe('getById()', () => {
    it('returns event detail by id', async () => {
      mockEventsService.getById.mockResolvedValue(mockEvent);

      const result = await controller.getById('01JHQEVENT001');

      expect(result).toEqual(mockEvent);
      expect(mockEventsService.getById).toHaveBeenCalledWith('01JHQEVENT001');
    });
  });

  describe('getAttempts()', () => {
    it('returns delivery attempts for an event ordered by attempt number', async () => {
      mockAttemptsService.getByEventId.mockResolvedValue([mockAttempt]);

      const result = await controller.getAttempts('01JHQEVENT001');

      expect(result).toHaveLength(1);
      expect(result[0]?.attemptNumber).toBe(1);
      expect(mockAttemptsService.getByEventId).toHaveBeenCalledWith('01JHQEVENT001');
    });
  });
});
