import type { CreateHookMateRoutingRuleInput, HookMateRoutingRule } from '@hookmate/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingRule } from './entities/routing-rule.entity';
import { RoutingRulesService } from './routing-rules.service';

function createMockEntity(overrides: Partial<RoutingRule> = {}): RoutingRule {
  const now = new Date('2026-01-15T12:00:00Z');

  return {
    id: 1,
    endpointId: { id: 'ep-01JHQ' } as never,
    priority: 10,
    matchType: 'header' as const,
    matchKey: 'X-Api-Key',
    matchValue: 'sk-123',
    destinationType: 'http' as const,
    destinationUrl: 'https://example.com/hook',
    createdAt: now,
    toPrimitive(this: RoutingRule): HookMateRoutingRule {
      return {
        id: this.id,
        endpointId:
          typeof this.endpointId === 'object'
            ? (this.endpointId as { id: string }).id
            : (this.endpointId as string),
        priority: this.priority,
        matchType: this.matchType,
        matchKey: this.matchKey,
        matchValue: this.matchValue,
        destinationType: this.destinationType,
        destinationUrl: this.destinationUrl,
        createdAt: this.createdAt.toISOString(),
      };
    },
    ...overrides,
  } as unknown as RoutingRule;
}

describe('RoutingRulesService', () => {
  let service: RoutingRulesService;
  let mockRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingRulesService,
        {
          provide: getRepositoryToken(RoutingRule),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<RoutingRulesService>(RoutingRulesService);
  });

  describe('list()', () => {
    it('returns empty array when no routing rules exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { priority: 'ASC' } });
    });

    it('returns all routing rules ordered by priority ASC', async () => {
      const entity1 = createMockEntity({ id: 1, priority: 10 });
      const entity2 = createMockEntity({ id: 2, priority: 20 });
      mockRepo.find.mockResolvedValue([entity1, entity2]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(1);
      expect(result[1]?.id).toBe(2);
    });

    it('maps entities to primitives via toPrimitive', async () => {
      const entity = createMockEntity({ id: 42, matchType: 'json_path', matchKey: '$.event' });
      mockRepo.find.mockResolvedValue([entity]);

      const result = await service.list();

      expect(result[0]).toMatchObject({
        id: 42,
        matchType: 'json_path',
        matchKey: '$.event',
      });
      expect(typeof result[0]?.createdAt).toBe('string');
    });
  });

  describe('getById()', () => {
    it('returns the routing rule when found', async () => {
      const entity = createMockEntity({ id: 77 });
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById(77);

      expect(result.id).toBe(77);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 77 } });
    });

    it('throws NotFoundException when routing rule does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByEndpointId()', () => {
    it('returns routing rules for an endpoint ordered by priority ASC', async () => {
      const endpointId = 'ep-01JHQ';
      const rule1 = createMockEntity({ id: 1, priority: 10 });
      const rule2 = createMockEntity({ id: 2, priority: 20 });
      const rule3 = createMockEntity({ id: 3, priority: 30 });
      mockRepo.find.mockResolvedValue([rule1, rule2, rule3]);

      const result = await service.getByEndpointId(endpointId);

      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe(1);
      expect(result[1]?.id).toBe(2);
      expect(result[2]?.id).toBe(3);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { endpointId: { id: endpointId } },
        order: { priority: 'ASC' },
      });
    });

    it('returns empty array when endpoint has no routing rules', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getByEndpointId('ep-no-rules');

      expect(result).toEqual([]);
    });
  });

  describe('create()', () => {
    it('creates a routing rule for an endpoint', async () => {
      const input: CreateHookMateRoutingRuleInput = {
        priority: 10,
        matchType: 'header',
        matchKey: 'X-Api-Key',
        matchValue: 'sk-123',
        destinationType: 'http',
        destinationUrl: 'https://example.com/hook',
      };
      const entity = createMockEntity({ id: 1, ...input });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create('ep-01JHQ', input);

      expect(result.id).toBe(1);
      expect(result.priority).toBe(10);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endpointId: { id: 'ep-01JHQ' },
          priority: 10,
          matchType: 'header',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(entity);
    });

    it('throws ConflictException when priority already exists for endpoint', async () => {
      const input: CreateHookMateRoutingRuleInput = {
        priority: 10,
        matchType: 'header',
        matchKey: 'X-Api-Key',
        matchValue: 'sk-123',
      };
      mockRepo.create.mockReturnValue(createMockEntity());
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create('ep-01JHQ', input)).rejects.toThrow(ConflictException);
    });
  });

  describe('update()', () => {
    it('updates a routing rule with partial fields', async () => {
      const entity = createMockEntity({ id: 1, priority: 10 });
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.save.mockResolvedValue({ ...entity, priority: 20 });

      const result = await service.update(1, { priority: 20 });

      expect(result.id).toBe(1);
      expect(result.priority).toBe(20);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFoundException when rule does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { priority: 10 })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when updated priority causes duplicate', async () => {
      const entity = createMockEntity({ id: 1, priority: 10 });
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.update(1, { priority: 20 })).rejects.toThrow(ConflictException);
    });
  });

  describe('delete()', () => {
    it('deletes a routing rule by id', async () => {
      const entity = createMockEntity({ id: 1 });
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.delete(1);

      expect(mockRepo.delete).toHaveBeenCalledWith(1);
    });

    it('throws NotFoundException when rule does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
