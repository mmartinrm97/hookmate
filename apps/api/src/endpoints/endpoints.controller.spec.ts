import type { HookMateEndpoint } from '@hookmate/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EndpointsController],
      providers: [
        {
          provide: EndpointsService,
          useValue: mockService,
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
});
