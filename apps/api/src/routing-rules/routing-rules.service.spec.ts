import type { HookMateRoutingRule } from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
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
  };

  beforeEach(async () => {
    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
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
});
