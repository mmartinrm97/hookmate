import 'reflect-metadata';
import type { HookMateAiSummary } from '@hookmate/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EndpointsService } from '../endpoints/endpoints.service';
import { AiSummariesController } from './ai-summaries.controller';
import { AiSummariesService } from './ai-summaries.service';

const mockSummary: HookMateAiSummary = {
  id: 1,
  endpointId: 'ep-01JHQ',
  periodStart: '2026-01-15T00:00:00.000Z',
  periodEnd: '2026-01-15T23:59:59.000Z',
  summaryText: 'All events delivered successfully.',
  eventCount: 150,
  failureCount: 2,
  topCategories: { payment: 80, auth: 70 },
  model: 'gpt-4o-mini',
  generatedAt: '2026-01-15T12:00:00.000Z',
};

describe('AiSummariesController', () => {
  let controller: AiSummariesController;
  let mockService: {
    listByEndpoint: ReturnType<typeof vi.fn>;
    generateOnDemand: ReturnType<typeof vi.fn>;
  };
  let mockEndpointsService: {
    getById: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      listByEndpoint: vi.fn(),
      generateOnDemand: vi.fn(),
    };
    mockEndpointsService = {
      getById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiSummariesController],
      providers: [
        { provide: AiSummariesService, useValue: mockService },
        { provide: EndpointsService, useValue: mockEndpointsService },
      ],
    }).compile();

    controller = module.get<AiSummariesController>(AiSummariesController);
  });

  describe('list()', () => {
    it('returns AI summaries for an endpoint', async () => {
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });
      mockService.listByEndpoint.mockResolvedValue([mockSummary]);

      const result = await controller.list('ep-01JHQ', {});

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(mockService.listByEndpoint).toHaveBeenCalledWith('ep-01JHQ', undefined, undefined);
    });

    it('passes from/to query params to service', async () => {
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });
      mockService.listByEndpoint.mockResolvedValue([mockSummary]);

      await controller.list('ep-01JHQ', {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-08T00:00:00.000Z',
      });

      expect(mockService.listByEndpoint).toHaveBeenCalledWith(
        'ep-01JHQ',
        '2026-01-01T00:00:00.000Z',
        '2026-01-08T00:00:00.000Z',
      );
    });

    it('returns empty array when no summaries exist', async () => {
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });
      mockService.listByEndpoint.mockResolvedValue([]);

      const result = await controller.list('ep-01JHQ', {});

      expect(result).toEqual([]);
    });

    it('throws 404 when endpoint does not exist', async () => {
      mockEndpointsService.getById.mockRejectedValue(new Error('Not found'));

      await expect(controller.list('ep-unknown', {})).rejects.toThrow('Not found');
    });
  });

  describe('generate()', () => {
    it('returns 202 with jobId when endpoint exists', async () => {
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });
      mockService.generateOnDemand.mockResolvedValue({ jobId: 'stub-ep-01JHQ-12345' });

      const result = await controller.generate('ep-01JHQ');

      expect(result).toEqual({ jobId: 'stub-ep-01JHQ-12345' });
      expect(mockService.generateOnDemand).toHaveBeenCalledWith('ep-01JHQ');
    });

    it('throws 404 when endpoint does not exist', async () => {
      mockEndpointsService.getById.mockRejectedValue(new Error('Not found'));

      await expect(controller.generate('ep-unknown')).rejects.toThrow('Not found');
    });
  });
});
