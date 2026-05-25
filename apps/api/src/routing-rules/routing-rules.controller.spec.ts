import 'reflect-metadata';
import type { HookMateRoutingRule } from '@hookmate/shared';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EndpointsService } from '../endpoints/endpoints.service';
import { RoutingRulesController } from './routing-rules.controller';
import { RoutingRulesService } from './routing-rules.service';

describe('RoutingRulesController', () => {
  let controller: RoutingRulesController;
  let mockRulesService: {
    getByEndpointId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockEndpointsService: {
    getById: ReturnType<typeof vi.fn>;
  };

  const mockRule: HookMateRoutingRule = {
    id: 1,
    endpointId: 'ep-01JHQ',
    priority: 10,
    matchType: 'header',
    matchKey: 'X-Api-Key',
    matchValue: 'sk-123',
    destinationType: 'http',
    destinationUrl: 'https://example.com/hook',
    createdAt: '2026-01-15T12:00:00.000Z',
  };

  beforeEach(async () => {
    mockRulesService = {
      getByEndpointId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockEndpointsService = {
      getById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutingRulesController],
      providers: [
        { provide: RoutingRulesService, useValue: mockRulesService },
        { provide: EndpointsService, useValue: mockEndpointsService },
      ],
    }).compile();

    controller = module.get<RoutingRulesController>(RoutingRulesController);
  });

  describe('listRules()', () => {
    it('returns routing rules for an endpoint ordered by priority', async () => {
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });
      mockRulesService.getByEndpointId.mockResolvedValue([mockRule]);

      const result = await controller.listRules('ep-01JHQ');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(mockEndpointsService.getById).toHaveBeenCalledWith('ep-01JHQ');
      expect(mockRulesService.getByEndpointId).toHaveBeenCalledWith('ep-01JHQ');
    });

    it('throws NotFoundException when endpoint does not exist', async () => {
      mockEndpointsService.getById.mockRejectedValue(new NotFoundException());

      await expect(controller.listRules('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRule()', () => {
    it('creates a routing rule and returns 201', async () => {
      const input = {
        priority: 10,
        matchType: 'header' as const,
        matchKey: 'X-Api-Key',
        matchValue: 'sk-123',
      };
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });
      mockRulesService.create.mockResolvedValue(mockRule);

      const result = await controller.createRule('ep-01JHQ', input);

      expect(result).toEqual(mockRule);
      expect(mockEndpointsService.getById).toHaveBeenCalledWith('ep-01JHQ');
      expect(mockRulesService.create).toHaveBeenCalledWith('ep-01JHQ', input);
    });

    it('throws NotFoundException when endpoint does not exist', async () => {
      mockEndpointsService.getById.mockRejectedValue(new NotFoundException());

      await expect(
        controller.createRule('nonexistent', { priority: 10, matchType: 'header' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRule()', () => {
    it('updates a routing rule and returns the updated rule', async () => {
      const updated = { ...mockRule, priority: 20 };
      mockRulesService.update.mockResolvedValue(updated);

      const result = await controller.updateRule('1', { priority: 20 });

      expect(result).toEqual(updated);
      expect(mockRulesService.update).toHaveBeenCalledWith(1, { priority: 20 });
    });
  });

  describe('deleteRule()', () => {
    it('deletes a routing rule and returns 204', async () => {
      mockRulesService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteRule('1');

      expect(result).toBeUndefined();
      expect(mockRulesService.delete).toHaveBeenCalledWith(1);
    });
  });
});
