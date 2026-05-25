import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EndpointsService } from '../endpoints/endpoints.service';
import { DeliveryAttempt } from '../delivery-attempts/entities/delivery-attempt.entity';
import { DlqEvent } from '../dlq-events/entities/dlq-event.entity';
import { Event } from '../events/entities/event.entity';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockEventRepo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let mockDlqRepo: {
    count: ReturnType<typeof vi.fn>;
  };
  let mockDeliveryAttemptRepo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let mockEndpointsService: {
    getById: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockEventRepo = { createQueryBuilder: vi.fn() };
    mockDlqRepo = { count: vi.fn() };
    mockDeliveryAttemptRepo = { createQueryBuilder: vi.fn() };
    mockEndpointsService = { getById: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: getRepositoryToken(DlqEvent), useValue: mockDlqRepo },
        { provide: getRepositoryToken(DeliveryAttempt), useValue: mockDeliveryAttemptRepo },
        { provide: EndpointsService, useValue: mockEndpointsService },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  describe('systemMetrics()', () => {
    it('returns system-wide metrics with counts by status', async () => {
      const mockQb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { status: 'received', count: '10' },
          { status: 'processing', count: '5' },
          { status: 'delivered', count: '80' },
          { status: 'failed', count: '3' },
          { status: 'dead_lettered', count: '2' },
        ]),
      };
      mockEventRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockDlqRepo.count.mockResolvedValue(2);

      const result = await service.systemMetrics();

      expect(result).toHaveProperty('totalEvents', 100);
      expect(result.byStatus).toEqual({
        received: 10,
        processing: 5,
        delivered: 80,
        failed: 3,
        dead_lettered: 2,
      });
      expect(result.dlqDepth).toBe(2);
      expect(result.errorRate).toBeCloseTo(0.05, 2); // (3+2)/100
      expect(mockEventRepo.createQueryBuilder).toHaveBeenCalledWith('event');
    });

    it('returns zero metrics when no events exist', async () => {
      const mockQb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      };
      mockEventRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockDlqRepo.count.mockResolvedValue(0);

      const result = await service.systemMetrics();

      expect(result.totalEvents).toBe(0);
      expect(result.byStatus).toEqual({});
      expect(result.dlqDepth).toBe(0);
      expect(result.errorRate).toBe(0);
    });
  });

  describe('endpointMetrics()', () => {
    it('returns endpoint metrics with latency percentiles', async () => {
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });

      const mockQb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({
          delivered: '95',
          failed: '5',
          p50: '45.5',
          p95: '120.3',
          p99: '250.7',
        }),
      };
      mockDeliveryAttemptRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.endpointMetrics('ep-01JHQ');

      expect(result.endpointId).toBe('ep-01JHQ');
      expect(result.delivered).toBe(95);
      expect(result.failed).toBe(5);
      expect(result.p50).toBeCloseTo(45.5);
      expect(result.p95).toBeCloseTo(120.3);
      expect(result.p99).toBeCloseTo(250.7);
      expect(result.period).toBe('24h');
      expect(mockDeliveryAttemptRepo.createQueryBuilder).toHaveBeenCalledWith('da');
    });

    it('returns null percentiles when no delivery attempts exist', async () => {
      mockEndpointsService.getById.mockResolvedValue({ id: 'ep-01JHQ' });

      const mockQb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({
          delivered: '0',
          failed: '0',
          p50: null,
          p95: null,
          p99: null,
        }),
      };
      mockDeliveryAttemptRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.endpointMetrics('ep-01JHQ');

      expect(result.delivered).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.p50).toBeNull();
      expect(result.p95).toBeNull();
      expect(result.p99).toBeNull();
    });

    it('throws NotFoundException when endpoint does not exist', async () => {
      mockEndpointsService.getById.mockRejectedValue(new NotFoundException('Not found'));

      await expect(service.endpointMetrics('ep-unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
