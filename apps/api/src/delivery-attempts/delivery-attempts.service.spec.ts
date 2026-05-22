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
  };

  beforeEach(async () => {
    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
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
});
