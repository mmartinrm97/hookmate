import type { HookMateDlqEvent } from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
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
  };

  beforeEach(async () => {
    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqEventsService,
        {
          provide: getRepositoryToken(DlqEvent),
          useValue: mockRepo,
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
});
