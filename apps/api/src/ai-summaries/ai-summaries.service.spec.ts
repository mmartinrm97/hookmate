import type { HookMateAiSummary } from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSummariesService } from './ai-summaries.service';
import { AiSummary } from './entities/ai-summary.entity';

function createMockEntity(overrides: Partial<AiSummary> = {}): AiSummary {
  const now = new Date('2026-01-15T12:00:00Z');

  return {
    id: 1,
    endpointId: { id: 'ep-01JHQ' } as never,
    periodStart: new Date('2026-01-15T00:00:00Z'),
    periodEnd: new Date('2026-01-15T23:59:59Z'),
    summaryText: 'All events delivered successfully.',
    eventCount: 150,
    failureCount: 2,
    topCategories: { payment: 80, auth: 70 },
    model: 'gpt-4o-mini',
    generatedAt: now,
    toPrimitive(this: AiSummary): HookMateAiSummary {
      return {
        id: this.id,
        endpointId:
          typeof this.endpointId === 'object'
            ? (this.endpointId as { id: string }).id
            : (this.endpointId as string),
        periodStart: this.periodStart.toISOString(),
        periodEnd: this.periodEnd.toISOString(),
        summaryText: this.summaryText,
        eventCount: this.eventCount,
        failureCount: this.failureCount,
        topCategories: this.topCategories,
        model: this.model,
        generatedAt: this.generatedAt.toISOString(),
      };
    },
    ...overrides,
  } as unknown as AiSummary;
}

function createMockRepo() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    createQueryBuilder: vi.fn(),
    save: vi.fn(),
    upsert: vi.fn(),
  };
}

function createMockQueue() {
  return { add: vi.fn() };
}

describe('AiSummariesService', () => {
  let service: AiSummariesService;
  let mockRepo: ReturnType<typeof createMockRepo>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(async () => {
    mockRepo = createMockRepo();
    mockQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSummariesService,
        {
          provide: getRepositoryToken(AiSummary),
          useValue: mockRepo,
        },
        {
          provide: getQueueToken('ai-summaries'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<AiSummariesService>(AiSummariesService);
  });

  describe('list()', () => {
    it('returns empty array when no AI summaries exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { generatedAt: 'DESC' } });
    });

    it('returns all AI summaries ordered by generatedAt DESC', async () => {
      const entity1 = createMockEntity({ id: 1 });
      const entity2 = createMockEntity({ id: 2 });
      mockRepo.find.mockResolvedValue([entity1, entity2]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(1);
      expect(result[1]?.id).toBe(2);
    });

    it('maps entities to primitives via toPrimitive', async () => {
      const entity = createMockEntity({ id: 42, summaryText: 'All good', model: 'gpt-4o-mini' });
      mockRepo.find.mockResolvedValue([entity]);

      const result = await service.list();

      expect(result[0]).toMatchObject({
        id: 42,
        summaryText: 'All good',
        model: 'gpt-4o-mini',
      });
      expect(typeof result[0]?.generatedAt).toBe('string');
    });
  });

  describe('getById()', () => {
    it('returns the AI summary when found', async () => {
      const entity = createMockEntity({ id: 55 });
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById(55);

      expect(result.id).toBe(55);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 55 } });
    });

    it('throws NotFoundException when AI summary does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listByEndpoint()', () => {
    it('returns summaries for an endpoint ordered by generatedAt DESC', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi
          .fn()
          .mockResolvedValue([createMockEntity({ id: 1 }), createMockEntity({ id: 2 })]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.listByEndpoint('ep-01JHQ');

      expect(result).toHaveLength(2);
      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('summary');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('summary.endpointId = :endpointId', {
        endpointId: 'ep-01JHQ',
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('summary.generatedAt', 'DESC');
    });

    it('filters by date range when from and to are provided', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([createMockEntity({ id: 1 })]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.listByEndpoint(
        'ep-01JHQ',
        '2026-01-01T00:00:00.000Z',
        '2026-01-08T00:00:00.000Z',
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('summary.endpointId = :endpointId', {
        endpointId: 'ep-01JHQ',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('summary.periodStart >= :from', {
        from: '2026-01-01T00:00:00.000Z',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('summary.periodEnd <= :to', {
        to: '2026-01-08T00:00:00.000Z',
      });
    });

    it('filters by from only when to is omitted', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([createMockEntity({ id: 1 })]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.listByEndpoint('ep-01JHQ', '2026-01-01T00:00:00.000Z');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('summary.periodStart >= :from', {
        from: '2026-01-01T00:00:00.000Z',
      });
    });

    it('filters by to only when from is omitted', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([createMockEntity({ id: 1 })]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.listByEndpoint('ep-01JHQ', undefined, '2026-01-08T00:00:00.000Z');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('summary.periodEnd <= :to', {
        to: '2026-01-08T00:00:00.000Z',
      });
    });

    it('returns empty array when no summaries exist', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.listByEndpoint('ep-unknown');

      expect(result).toEqual([]);
    });
  });

  describe('upsert()', () => {
    const upsertInput = {
      endpointId: 'ep-01JHQ',
      periodStart: '2026-01-15T00:00:00.000Z',
      periodEnd: '2026-01-15T23:59:59.000Z',
      summaryText: 'Most events delivered successfully.',
      eventCount: 150,
      failureCount: 2,
      topCategories: { 'payment.charge': 100, 'auth.login': 50 } as Record<string, number>,
      model: 'gpt-4o-mini',
    };

    function setupMockCreate(): void {
      mockRepo.create.mockImplementation((data: Record<string, unknown>) => {
        const result = {
          ...data,
          toPrimitive() {
            return {
              endpointId:
                typeof data.endpointId === 'object'
                  ? (data.endpointId as { id: string }).id
                  : (data.endpointId as string),
              periodStart: (data.periodStart as Date).toISOString(),
              periodEnd: (data.periodEnd as Date).toISOString(),
              summaryText: data.summaryText as string,
              eventCount: data.eventCount as number,
              failureCount: data.failureCount as number,
              topCategories: data.topCategories as Record<string, number>,
              model: data.model as string,
              generatedAt: new Date().toISOString(),
              id: 1,
            };
          },
        };
        return result as unknown as AiSummary;
      });
    }

    it('inserts a new summary via upsert on conflict endpointId+periodStart', async () => {
      setupMockCreate();
      mockRepo.upsert.mockResolvedValue({ raw: [], generatedMaps: [] });

      const result = await service.upsert(upsertInput);

      expect(result.endpointId).toBe('ep-01JHQ');
      expect(result.summaryText).toBe('Most events delivered successfully.');
      expect(mockRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          endpointId: expect.objectContaining({ id: 'ep-01JHQ' }),
          periodStart: new Date('2026-01-15T00:00:00.000Z'),
          periodEnd: new Date('2026-01-15T23:59:59.000Z'),
        }),
        ['endpointId', 'periodStart'],
      );
    });

    it('updates an existing summary when the same endpointId+periodStart exists', async () => {
      setupMockCreate();
      mockRepo.upsert.mockResolvedValue({ raw: [], generatedMaps: [] });

      const updated = {
        ...upsertInput,
        summaryText: 'Updated summary text.',
        eventCount: 200,
      };

      const result = await service.upsert(updated);

      expect(result.summaryText).toBe('Updated summary text.');
      expect(result.eventCount).toBe(200);
      expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateOnDemand()', () => {
    it('enqueues a BullMQ job to ai-summaries queue and returns job ID', async () => {
      mockQueue.add.mockResolvedValue({ id: 'bull-job-123' });

      const result = await service.generateOnDemand('ep-01JHQ');

      expect(result.jobId).toBe('bull-job-123');
      expect(mockQueue.add).toHaveBeenCalledWith('generate-summary', {
        jobType: 'on-demand',
        endpointId: 'ep-01JHQ',
      });
    });

    it('throws when queue.add fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis connection lost'));

      await expect(service.generateOnDemand('ep-01JHQ')).rejects.toThrow('Redis connection lost');
    });
  });
});
