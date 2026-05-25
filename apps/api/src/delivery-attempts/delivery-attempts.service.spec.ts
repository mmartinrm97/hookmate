import type { HookMateDeliveryAttempt } from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryAttemptsService } from './delivery-attempts.service';
import { DeliveryAttempt } from './entities/delivery-attempt.entity';

function createMockEntity(overrides: Partial<DeliveryAttempt> = {}): DeliveryAttempt {
  const now = new Date('2026-01-15T12:00:00Z');

  return {
    id: 1,
    eventId: { id: '01JHQ-EVENT' } as never,
    attemptNumber: 1,
    destinationUrl: 'https://example.com/webhook',
    httpStatus: 200,
    responseBody: '{"ok":true}',
    latencyMs: 150,
    status: 'success' as const,
    attemptedAt: now,
    toPrimitive(this: DeliveryAttempt): HookMateDeliveryAttempt {
      return {
        id: this.id,
        eventId:
          typeof this.eventId === 'object'
            ? (this.eventId as { id: string }).id
            : (this.eventId as string),
        attemptNumber: this.attemptNumber,
        destinationUrl: this.destinationUrl,
        httpStatus: this.httpStatus,
        responseBody: this.responseBody,
        latencyMs: this.latencyMs,
        status: this.status ?? 'failed',
        attemptedAt: this.attemptedAt.toISOString(),
      };
    },
    ...overrides,
  } as unknown as DeliveryAttempt;
}

describe('DeliveryAttemptsService', () => {
  let service: DeliveryAttemptsService;
  let mockRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryAttemptsService,
        {
          provide: getRepositoryToken(DeliveryAttempt),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<DeliveryAttemptsService>(DeliveryAttemptsService);
  });

  describe('list()', () => {
    it('returns empty array when no delivery attempts exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { attemptedAt: 'DESC' } });
    });

    it('returns all delivery attempts ordered by attemptedAt DESC', async () => {
      const entity1 = createMockEntity({ id: 1 });
      const entity2 = createMockEntity({ id: 2 });
      mockRepo.find.mockResolvedValue([entity1, entity2]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(1);
      expect(result[1]?.id).toBe(2);
    });

    it('maps entities to primitives via toPrimitive', async () => {
      const entity = createMockEntity({ id: 42, httpStatus: 200 });
      mockRepo.find.mockResolvedValue([entity]);

      const result = await service.list();

      expect(result[0]).toMatchObject({
        id: 42,
        destinationUrl: 'https://example.com/webhook',
        httpStatus: 200,
      });
      expect(typeof result[0]?.attemptedAt).toBe('string');
    });
  });

  describe('getById()', () => {
    it('returns the delivery attempt when found', async () => {
      const entity = createMockEntity({ id: 99 });
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById(99);

      expect(result.id).toBe(99);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 99 } });
    });

    it('throws NotFoundException when delivery attempt does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('records a successful delivery attempt with http_status and latency', async () => {
      const input = {
        eventId: 'evt-01JHQ',
        attemptNumber: 1,
        destinationUrl: 'https://example.com/hook',
        httpStatus: 200,
        responseBody: '{"ok":true}',
        latencyMs: 150,
        status: 'success' as const,
      };
      const entity = createMockEntity({
        id: 100,
        eventId: { id: input.eventId } as never,
        attemptNumber: input.attemptNumber,
        destinationUrl: input.destinationUrl,
        httpStatus: input.httpStatus,
        responseBody: input.responseBody,
        latencyMs: input.latencyMs,
        status: input.status,
      });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create(input);

      expect(result.id).toBe(100);
      expect(result.eventId).toBe('evt-01JHQ');
      expect(result.httpStatus).toBe(200);
      expect(result.latencyMs).toBe(150);
      expect(result.status).toBe('success');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: { id: 'evt-01JHQ' },
          destinationUrl: 'https://example.com/hook',
          status: 'success',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(entity);
    });

    it('records a timeout attempt with null http_status', async () => {
      const input = {
        eventId: 'evt-02JHQ',
        attemptNumber: 1,
        destinationUrl: 'https://example.com/hook',
        httpStatus: null,
        responseBody: null,
        latencyMs: null,
        status: 'timeout' as const,
      };
      const entity = createMockEntity({
        id: 101,
        eventId: { id: input.eventId } as never,
        attemptNumber: input.attemptNumber,
        destinationUrl: input.destinationUrl,
        httpStatus: input.httpStatus,
        responseBody: input.responseBody,
        latencyMs: input.latencyMs,
        status: input.status,
      });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create(input);

      expect(result.status).toBe('timeout');
      expect(result.httpStatus).toBeNull();
      expect(result.latencyMs).toBeNull();
      expect(result.responseBody).toBeNull();
    });
  });

  describe('getByEventId()', () => {
    it('returns delivery attempts for a given event ordered by attemptNumber ASC', async () => {
      const attempt1 = createMockEntity({ id: 1, attemptNumber: 1 });
      const attempt2 = createMockEntity({ id: 2, attemptNumber: 2 });
      mockRepo.find.mockResolvedValue([attempt1, attempt2]);

      const result = await service.getByEventId('evt-01JHQ');

      expect(result).toHaveLength(2);
      expect(result[0]?.attemptNumber).toBe(1);
      expect(result[1]?.attemptNumber).toBe(2);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { eventId: { id: 'evt-01JHQ' } as never },
        order: { attemptNumber: 'ASC' },
      });
    });

    it('returns empty array when event has no delivery attempts', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getByEventId('evt-no-attempts');

      expect(result).toEqual([]);
    });

    it('maps entities to primitives', async () => {
      const attempt = createMockEntity({ id: 42, httpStatus: 200, status: 'success' as const });
      mockRepo.find.mockResolvedValue([attempt]);

      const result = await service.getByEventId('evt-01JHQ');

      expect(result[0]).toMatchObject({
        id: 42,
        httpStatus: 200,
        status: 'success',
      });
      expect(typeof result[0]?.attemptedAt).toBe('string');
    });
  });
});
