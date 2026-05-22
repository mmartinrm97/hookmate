import type { HookMateEvent } from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Event } from './entities/event.entity';
import { EventsService } from './events.service';

function createMockEntity(overrides: Partial<Event> = {}): Event {
  const now = new Date('2026-01-15T12:00:00Z');

  return {
    id: '01JHQABC123DEF456GHI789JK',
    endpointId: { id: 'ep-01JHQ' } as never,
    payload: { message: 'hello' },
    headers: { 'content-type': 'application/json' },
    sourceIp: '192.168.1.1',
    status: 'received' as const,
    category: null,
    traceId: 'trace-abc-123',
    receivedAt: now,
    deliveredAt: null,
    toPrimitive(this: Event): HookMateEvent {
      return {
        id: this.id,
        endpointId:
          typeof this.endpointId === 'object'
            ? (this.endpointId as { id: string }).id
            : (this.endpointId as string),
        payload: this.payload,
        headers: this.headers,
        sourceIp: this.sourceIp,
        status: this.status,
        category: this.category,
        traceId: this.traceId,
        receivedAt: this.receivedAt.toISOString(),
        deliveredAt: this.deliveredAt?.toISOString() ?? null,
      };
    },
    ...overrides,
  } as unknown as Event;
}

describe('EventsService', () => {
  let service: EventsService;
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
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('list()', () => {
    it('returns empty array when no events exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { receivedAt: 'DESC' } });
    });

    it('returns all events ordered by receivedAt DESC', async () => {
      const entity1 = createMockEntity({ id: 'event-1' });
      const entity2 = createMockEntity({ id: 'event-2' });
      mockRepo.find.mockResolvedValue([entity1, entity2]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('event-1');
      expect(result[1]?.id).toBe('event-2');
    });

    it('maps entities to primitives via toPrimitive', async () => {
      const entity = createMockEntity({ id: 'event-map-test' });
      mockRepo.find.mockResolvedValue([entity]);

      const result = await service.list();

      expect(result[0]).toMatchObject({
        id: 'event-map-test',
        status: 'received',
        sourceIp: '192.168.1.1',
      });
      expect(typeof result[0]?.receivedAt).toBe('string');
    });
  });

  describe('getById()', () => {
    it('returns the event when found', async () => {
      const entity = createMockEntity({ id: 'existing-id' });
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById('existing-id');

      expect(result.id).toBe('existing-id');
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'existing-id' } });
    });

    it('throws NotFoundException when event does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
