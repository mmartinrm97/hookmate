import type { HookMateDlqEvent } from '@hookmate/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DlqEventsService } from './dlq-events.service';
import { DlqEvent } from './entities/dlq-event.entity';

function createMockEntity(overrides: Partial<DlqEvent> = {}): DlqEvent {
  const now = new Date('2026-01-15T12:00:00Z');

  return {
    id: '01JHQ-DLQ-123',
    eventId: { id: '01JHQ-EVENT' } as never,
    endpointId: { id: 'ep-01JHQ' } as never,
    failureReason: 'Max retries exceeded',
    attemptsJson: [
      { attempt: 1, status: 502 },
      { attempt: 2, status: 503 },
    ],
    endpointSnapshot: { name: 'test', destinationUrl: 'https://example.com/hook' },
    createdAt: now,
    retriedAt: null,
    toPrimitive(this: DlqEvent): HookMateDlqEvent {
      return {
        id: this.id,
        eventId:
          typeof this.eventId === 'object'
            ? (this.eventId as { id: string }).id
            : (this.eventId as string),
        endpointId:
          typeof this.endpointId === 'object'
            ? (this.endpointId as { id: string }).id
            : (this.endpointId as string),
        failureReason: this.failureReason,
        attemptsJson: this.attemptsJson,
        endpointSnapshot: this.endpointSnapshot,
        createdAt: this.createdAt.toISOString(),
        retriedAt: this.retriedAt?.toISOString() ?? null,
      };
    },
    ...overrides,
  } as unknown as DlqEvent;
}

describe('DlqEventsService', () => {
  let service: DlqEventsService;
  let mockRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockQueue: {
    add: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn(),
      delete: vi.fn(),
    };
    mockQueue = {
      add: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqEventsService,
        {
          provide: getRepositoryToken(DlqEvent),
          useValue: mockRepo,
        },
        {
          provide: getQueueToken('retries'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DlqEventsService>(DlqEventsService);
  });

  describe('list()', () => {
    it('returns empty array when no DLQ events exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });

    it('returns all DLQ events ordered by createdAt DESC', async () => {
      const entity1 = createMockEntity({ id: 'dlq-1' });
      const entity2 = createMockEntity({ id: 'dlq-2' });
      mockRepo.find.mockResolvedValue([entity1, entity2]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('dlq-1');
      expect(result[1]?.id).toBe('dlq-2');
    });

    it('maps entities to primitives via toPrimitive', async () => {
      const entity = createMockEntity({ id: 'dlq-map-test', failureReason: 'Timeout' });
      mockRepo.find.mockResolvedValue([entity]);

      const result = await service.list();

      expect(result[0]).toMatchObject({
        id: 'dlq-map-test',
        failureReason: 'Timeout',
      });
      expect(typeof result[0]?.createdAt).toBe('string');
    });
  });

  describe('getById()', () => {
    it('returns the DLQ event when found', async () => {
      const entity = createMockEntity({ id: 'existing-dlq-id' });
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById('existing-dlq-id');

      expect(result.id).toBe('existing-dlq-id');
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'existing-dlq-id' } });
    });

    it('throws NotFoundException when DLQ event does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('nonexistent-dlq-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('records a DLQ event with full context snapshot', async () => {
      const input = {
        eventId: 'evt-failed-01',
        endpointId: 'ep-01JHQ',
        failureReason: 'Max retries exceeded after 5 attempts',
        attemptsJson: [
          { attempt: 1, status: 502 },
          { attempt: 2, status: 503 },
          { attempt: 3, status: 504 },
        ],
        endpointSnapshot: {
          name: 'test-endpoint',
          destinationUrl: 'https://example.com/hook',
          retryBaseDelayMs: 5000,
          maxRetries: 5,
        },
      };
      const entity = createMockEntity({
        id: 'dlq-created-01',
        eventId: { id: input.eventId } as never,
        endpointId: { id: input.endpointId } as never,
        failureReason: input.failureReason,
        attemptsJson: input.attemptsJson,
        endpointSnapshot: input.endpointSnapshot,
      });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create(input);

      expect(result.id).toBe('dlq-created-01');
      expect(result.eventId).toBe('evt-failed-01');
      expect(result.endpointId).toBe('ep-01JHQ');
      expect(result.failureReason).toBe('Max retries exceeded after 5 attempts');
      expect(result.attemptsJson).toHaveLength(3);
      expect(result.endpointSnapshot).toMatchObject({
        name: 'test-endpoint',
        destinationUrl: 'https://example.com/hook',
      });
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: { id: 'evt-failed-01' },
          endpointId: { id: 'ep-01JHQ' },
          failureReason: 'Max retries exceeded after 5 attempts',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(entity);
    });
  });

  describe('listByEndpointId()', () => {
    it('returns empty array when no DLQ events match endpoint', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.listByEndpointId('ep-nonexistent');

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { endpointId: { id: 'ep-nonexistent' } },
        order: { createdAt: 'DESC' },
      });
    });

    it('returns filtered DLQ events when endpointId is provided', async () => {
      const entity = createMockEntity({ id: 'dlq-ep1', endpointId: { id: 'ep-01JHQ' } as never });
      mockRepo.find.mockResolvedValue([entity]);

      const result = await service.listByEndpointId('ep-01JHQ');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('dlq-ep1');
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { endpointId: { id: 'ep-01JHQ' } },
        order: { createdAt: 'DESC' },
      });
    });

    it('returns all DLQ events when endpointId is not provided', async () => {
      const entity1 = createMockEntity({ id: 'dlq-all-1' });
      const entity2 = createMockEntity({ id: 'dlq-all-2' });
      mockRepo.find.mockResolvedValue([entity1, entity2]);

      const result = await service.listByEndpointId();

      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });
  });

  describe('retry()', () => {
    it('re-enqueues a DLQ event and marks retriedAt', async () => {
      const entity = createMockEntity({ id: 'dlq-retry-1' });
      mockRepo.findOne.mockResolvedValue(entity);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });
      mockRepo.save.mockResolvedValue({ ...entity, retriedAt: new Date() });

      const result = await service.retry('dlq-retry-1');

      expect(result.jobId).toBe('job-123');
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'dlq-retry-1' } });
      expect(mockQueue.add).toHaveBeenCalledWith('process-retry', {
        event_id: '01JHQ-EVENT',
        endpoint_id: 'ep-01JHQ',
        attempt_number: 1,
      });
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ retriedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when DLQ event does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.retry('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when DLQ event has already been retried', async () => {
      const entity = createMockEntity({ retriedAt: new Date('2026-01-16T12:00:00Z') });
      mockRepo.findOne.mockResolvedValue(entity);

      await expect(service.retry('dlq-already-retried')).rejects.toThrow(ConflictException);
    });
  });

  describe('retryAll()', () => {
    it('re-enqueues all non-retried DLQ events for endpoint and returns count', async () => {
      const entity1 = createMockEntity({ id: 'dlq-1' });
      const entity2 = createMockEntity({ id: 'dlq-2' });
      mockRepo.find.mockResolvedValue([entity1, entity2]);
      mockQueue.add.mockResolvedValue({ id: 'job' });
      mockRepo.save.mockResolvedValue(entity1);

      const result = await service.retryAll('ep-01JHQ');

      expect(result.count).toBe(2);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it('caps at 500 events per batch', async () => {
      const entities = Array.from({ length: 600 }, (_, i) =>
        createMockEntity({ id: `dlq-batch-${i}` }),
      );
      mockRepo.find.mockResolvedValue(entities);
      mockQueue.add.mockResolvedValue({ id: 'job' });
      mockRepo.save.mockResolvedValue(entities[0]);

      const result = await service.retryAll('ep-01JHQ');

      expect(result.count).toBe(500);
      expect(mockQueue.add).toHaveBeenCalledTimes(500);
    });

    it('returns zero count when no events found', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.retryAll('ep-empty');

      expect(result.count).toBe(0);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('purgeByEndpointId()', () => {
    it('deletes all DLQ events for the endpoint', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 5, raw: {} });

      await service.purgeByEndpointId('ep-01JHQ');

      expect(mockRepo.delete).toHaveBeenCalledWith({ endpointId: { id: 'ep-01JHQ' } });
    });
  });
});
