import type { HookMateEndpoint } from '@hookmate/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CIRCUIT_BREAKER, type CircuitStatus } from '../circuit-breaker/circuit-breaker.types';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';

describe('EndpointsController', () => {
  let controller: EndpointsController;
  let mockService: {
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let mockCircuitBreaker: {
    getStatus: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

  const mockEndpoint: HookMateEndpoint = {
    id: '01JHQABC123DEF456GHI789JK',
    name: 'Test webhook',
    destinationUrl: 'https://example.com/webhook',
    status: 'active',
    maxRetries: 5,
    retryBaseDelayMs: 5000,
    dlqThreshold: 100,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
  };

  beforeEach(async () => {
    mockService = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    mockCircuitBreaker = {
      getStatus: vi.fn(),
      reset: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EndpointsController],
      providers: [
        {
          provide: EndpointsService,
          useValue: mockService,
        },
        {
          provide: CIRCUIT_BREAKER,
          useValue: mockCircuitBreaker,
        },
      ],
    }).compile();

    controller = module.get<EndpointsController>(EndpointsController);
  });

  describe('update()', () => {
    it('calls service.update with id and body and returns the updated endpoint', async () => {
      const updated = { ...mockEndpoint, name: 'Updated' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('test-id', { name: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockService.update).toHaveBeenCalledWith('test-id', { name: 'Updated' });
    });
  });

  describe('softDelete()', () => {
    it('calls service.softDelete with id and returns no content (204)', async () => {
      mockService.softDelete.mockResolvedValue({ ...mockEndpoint, status: 'deleted' as const });

      const result = await controller.softDelete('test-id');

      expect(result).toBeUndefined();
      expect(mockService.softDelete).toHaveBeenCalledWith('test-id');
    });
  });

  describe('getCircuitStatus()', () => {
    it('returns circuit status for an endpoint', async () => {
      const status: CircuitStatus = {
        state: 'open',
        failureRate: 0.85,
        windowSeconds: 300,
        cooldownRemainingSeconds: 45,
      };
      mockCircuitBreaker.getStatus.mockResolvedValue(status);

      const result = await controller.getCircuitStatus('test-id');

      expect(result).toEqual(status);
      expect(mockCircuitBreaker.getStatus).toHaveBeenCalledWith('test-id');
    });
  });

  describe('resetCircuit()', () => {
    it('calls reset and returns ok', async () => {
      mockCircuitBreaker.reset.mockResolvedValue(undefined);

      const result = await controller.resetCircuit('test-id');

      expect(result).toEqual({ ok: true });
      expect(mockCircuitBreaker.reset).toHaveBeenCalledWith('test-id');
    });
  });
});
