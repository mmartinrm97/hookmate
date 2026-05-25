import type { HookMateEvent } from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
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
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createQueryBuilder: Mock;
  };

  beforeEach(async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn(),
      getManyAndCount: vi.fn(),
      update: vi.fn(),
      set: vi.fn(),
      execute: vi.fn(),
    };

    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
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

  describe('create()', () => {
    it('persists an event with all required fields and returns a primitive', async () => {
      const input = {
        id: 'evt-01JHQ',
        endpointId: 'ep-01JHQ',
        payload: { type: 'test', data: 'hello' },
        headers: { 'content-type': 'application/json' },
        sourceIp: '10.0.0.1',
        traceId: 'trace-abc',
      };
      const entity = createMockEntity({
        id: input.id,
        endpointId: { id: input.endpointId } as never,
        payload: input.payload,
        headers: input.headers,
        sourceIp: input.sourceIp,
        traceId: input.traceId,
      });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create(input);

      expect(result.id).toBe('evt-01JHQ');
      expect(result.endpointId).toBe('ep-01JHQ');
      expect(result.payload).toEqual({ type: 'test', data: 'hello' });
      expect(result.status).toBe('received');
      expect(result.traceId).toBe('trace-abc');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt-01JHQ',
          endpointId: { id: 'ep-01JHQ' },
          payload: { type: 'test', data: 'hello' },
          status: 'received',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(entity);
    });

    it('sets default status to received', async () => {
      const input = {
        id: 'evt-02JHQ',
        endpointId: 'ep-02JHQ',
        payload: { msg: 'test' },
      };
      const entity = createMockEntity({
        id: input.id,
        endpointId: { id: input.endpointId } as never,
        payload: input.payload,
      });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create({ ...input, status: undefined });

      expect(result.status).toBe('received');
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'received' }));
    });

    it('rejects when the database save fails', async () => {
      const input = {
        id: 'evt-03JHQ',
        endpointId: 'ep-03JHQ',
        payload: { msg: 'fail' },
      };
      mockRepo.create.mockReturnValue({ id: input.id } as Event);
      mockRepo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.create(input)).rejects.toThrow('DB connection lost');
    });
  });

  describe('updateStatus()', () => {
    it('transitions to delivered and sets deliveredAt when status is delivered', async () => {
      const existingId = 'evt-to-deliver';
      const now = new Date('2026-01-15T13:00:00Z');
      const entity = createMockEntity({
        id: existingId,
        status: 'received',
        deliveredAt: null,
      });
      const updatedEntity = createMockEntity({
        id: existingId,
        status: 'delivered',
        deliveredAt: now,
      });
      mockRepo.findOne.mockResolvedValueOnce(entity);
      mockRepo.save.mockResolvedValue(updatedEntity);
      mockRepo.findOne.mockResolvedValueOnce(updatedEntity);

      const result = await service.updateStatus(existingId, 'delivered', now);

      expect(result.status).toBe('delivered');
      expect(result.deliveredAt).toBe(now.toISOString());
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: existingId } });
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'delivered', deliveredAt: now }),
      );
    });

    it('transitions to dead_lettered without setting deliveredAt', async () => {
      const existingId = 'evt-to-dlq';
      const entity = createMockEntity({
        id: existingId,
        status: 'failed',
        deliveredAt: null,
      });
      const updatedEntity = createMockEntity({
        id: existingId,
        status: 'dead_lettered',
        deliveredAt: null,
      });
      mockRepo.findOne.mockResolvedValueOnce(entity);
      mockRepo.save.mockResolvedValue(updatedEntity);
      mockRepo.findOne.mockResolvedValueOnce(updatedEntity);

      const result = await service.updateStatus(existingId, 'dead_lettered');

      expect(result.status).toBe('dead_lettered');
      expect(result.deliveredAt).toBeNull();
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'dead_lettered' }),
      );
    });

    it('throws NotFoundException when event does not exist', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.updateStatus('nonexistent', 'delivered')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listFiltered()', () => {
    it('returns all events with pagination when no filters provided', async () => {
      const entity1 = createMockEntity({ id: 'event-1' });
      const entity2 = createMockEntity({ id: 'event-2' });
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[entity1, entity2], 2]);

      const result = await service.listFiltered({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('event');
    });

    it('filters by endpointId when provided', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listFiltered({ endpointId: 'ep-01JHQ' });

      expect(qb.andWhere).toHaveBeenCalledWith('event.endpointId = :endpointId', {
        endpointId: 'ep-01JHQ',
      });
    });

    it('filters by status when provided', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listFiltered({ status: 'delivered' });

      expect(qb.andWhere).toHaveBeenCalledWith('event.status = :status', {
        status: 'delivered',
      });
    });

    it('filters by category when provided', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listFiltered({ category: 'billing' });

      expect(qb.andWhere).toHaveBeenCalledWith('event.category = :category', {
        category: 'billing',
      });
    });

    it('filters by date range when from/to provided', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listFiltered({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-15T23:59:59.000Z',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('event.receivedAt BETWEEN :from AND :to', {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-15T23:59:59.000Z',
      });
    });

    it('applies pagination with custom page and limit', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listFiltered({ page: 3, limit: 20 });

      expect(qb.skip).toHaveBeenCalledWith(40); // (3-1) * 20
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('orders by receivedAt DESC', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listFiltered({});

      expect(qb.orderBy).toHaveBeenCalledWith('event.receivedAt', 'DESC');
    });

    it('returns mapped primitive items', async () => {
      const entity = createMockEntity({
        id: 'evt-mapped',
        status: 'delivered' as const,
      });
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[entity], 1]);

      const result = await service.listFiltered({});

      expect(result.items[0]).toMatchObject({
        id: 'evt-mapped',
        status: 'delivered',
      });
      expect(typeof result.items[0]?.receivedAt).toBe('string');
    });

    it('applies status filter alongside endpointId filter', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listFiltered({
        endpointId: 'ep-01JHQ',
        status: 'failed',
      });

      // Should have been called with endpointId and status
      const andWhereCalls = qb.andWhere.mock.calls;
      const endpointCall = andWhereCalls.find(
        (c: unknown[]) => (c as string[])[0] === 'event.endpointId = :endpointId',
      );
      const statusCall = andWhereCalls.find(
        (c: unknown[]) => (c as string[])[0] === 'event.status = :status',
      );

      expect(endpointCall).toBeDefined();
      expect(statusCall).toBeDefined();
    });
  });

  describe('getUncategorizedEvents()', () => {
    it('returns uncategorized events for an endpoint within date range', async () => {
      const entity1 = createMockEntity({ id: 'event-1', category: null });
      const entity2 = createMockEntity({ id: 'event-2', category: null });
      const qb = mockRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([entity1, entity2]);

      const from = '2026-01-01T00:00:00.000Z';
      const to = '2026-01-15T23:59:59.000Z';
      const result = await service.getUncategorizedEvents('ep-01JHQ', from, to);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('event-1');
      expect(qb.andWhere).toHaveBeenCalledWith('event.endpointId = :endpointId', {
        endpointId: 'ep-01JHQ',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('event.category IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('event.receivedAt BETWEEN :from AND :to', {
        from,
        to,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('event.receivedAt', 'DESC');
      expect(qb.getMany).toHaveBeenCalled();
    });

    it('returns empty array when no uncategorized events exist', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);

      const result = await service.getUncategorizedEvents(
        'ep-01JHQ',
        '2026-01-01T00:00:00.000Z',
        '2026-01-15T23:59:59.000Z',
      );

      expect(result).toEqual([]);
    });

    it('does not paginate results', async () => {
      const qb = mockRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);

      await service.getUncategorizedEvents(
        'ep-01JHQ',
        '2026-01-01T00:00:00.000Z',
        '2026-01-15T23:59:59.000Z',
      );

      expect(qb.skip).not.toHaveBeenCalled();
      expect(qb.take).not.toHaveBeenCalled();
    });
  });

  describe('batchUpdateCategories()', () => {
    it('updates each event category via repo.update in a transaction', async () => {
      mockRepo.manager = {
        transaction: vi.fn().mockImplementation(async (cb: (m: unknown) => Promise<void>) => {
          const mockManager = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
          await cb(mockManager);
        }),
      };

      const updates = new Map<string, string>([
        ['evt-1', 'payment.charge'],
        ['evt-2', 'auth.login'],
      ]);

      await service.batchUpdateCategories(updates);

      expect(mockRepo.manager.transaction).toHaveBeenCalled();
    });
  });
});
