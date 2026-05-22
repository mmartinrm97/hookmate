import {
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    const mockHealth = {
      check: vi.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
    } as unknown as HealthCheckService;

    const mockDb = {
      pingCheck: vi.fn().mockResolvedValue({ database: { status: 'up' } }),
    } as unknown as TypeOrmHealthIndicator;

    const mockMemory = {
      checkHeap: vi.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
    } as unknown as MemoryHealthIndicator;

    controller = new HealthController(mockHealth, mockDb, mockMemory);
  });

  it('returns the API root metadata', () => {
    expect(controller.getRoot()).toEqual({
      service: 'hookmate-api',
      health: '/api/v1/health',
      endpoints: '/api/v1/endpoints',
      docs: '/api/docs',
    });
  });

  it('delegates health check to terminus', async () => {
    const result = await controller.getHealth();

    expect(result).toEqual(expect.objectContaining({ status: 'ok' }));
  });
});
