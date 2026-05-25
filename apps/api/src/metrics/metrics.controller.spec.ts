import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndpointMetricsDto } from './dto/endpoint-metrics.dto';
import type { SystemMetricsDto } from './dto/system-metrics.dto';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let mockService: {
    systemMetrics: ReturnType<typeof vi.fn>;
    endpointMetrics: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      systemMetrics: vi.fn(),
      endpointMetrics: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: mockService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  describe('system()', () => {
    it('returns system-wide metrics', async () => {
      const expected: SystemMetricsDto = {
        totalEvents: 100,
        byStatus: { delivered: 80, failed: 3, received: 10, processing: 5, dead_lettered: 2 },
        dlqDepth: 2,
        errorRate: 0.05,
      };
      mockService.systemMetrics.mockResolvedValue(expected);

      const result = await controller.system();

      expect(result).toEqual(expected);
      expect(mockService.systemMetrics).toHaveBeenCalledOnce();
    });
  });

  describe('endpoint()', () => {
    it('returns per-endpoint metrics', async () => {
      const expected: EndpointMetricsDto = {
        endpointId: 'ep-01JHQ',
        delivered: 95,
        failed: 5,
        p50: 45.5,
        p95: 120.3,
        p99: 250.7,
        period: '24h',
      };
      mockService.endpointMetrics.mockResolvedValue(expected);

      const result = await controller.endpoint('ep-01JHQ');

      expect(result).toEqual(expected);
      expect(mockService.endpointMetrics).toHaveBeenCalledWith('ep-01JHQ');
    });
  });
});
