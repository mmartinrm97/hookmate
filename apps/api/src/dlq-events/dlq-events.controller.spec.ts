import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DlqEventsController } from './dlq-events.controller';
import { DlqEventsService } from './dlq-events.service';

describe('DlqEventsController', () => {
  let controller: DlqEventsController;
  let mockService: {
    listByEndpointId: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
    retryAll: ReturnType<typeof vi.fn>;
    purgeByEndpointId: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      listByEndpointId: vi.fn(),
      retry: vi.fn(),
      retryAll: vi.fn(),
      purgeByEndpointId: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DlqEventsController],
      providers: [
        {
          provide: DlqEventsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DlqEventsController>(DlqEventsController);
  });

  describe('list()', () => {
    it('calls service.listByEndpointId with query params and returns result', async () => {
      const mockResult = [{ id: 'dlq-1' }];
      mockService.listByEndpointId.mockResolvedValue(mockResult);

      const result = await controller.list({ endpointId: 'ep-01JHQ', page: 1, limit: 50 });

      expect(result).toEqual(mockResult);
      expect(mockService.listByEndpointId).toHaveBeenCalledWith('ep-01JHQ');
    });

    it('calls service.listByEndpointId with no filter when endpointId is omitted', async () => {
      mockService.listByEndpointId.mockResolvedValue([]);

      const result = await controller.list({});

      expect(result).toEqual([]);
      expect(mockService.listByEndpointId).toHaveBeenCalledWith(undefined);
    });
  });

  describe('retry()', () => {
    it('calls service.retry with id and returns 202 result', async () => {
      mockService.retry.mockResolvedValue({ jobId: 'job-123' });

      const result = await controller.retry('dlq-1');

      expect(result).toEqual({ jobId: 'job-123' });
      expect(mockService.retry).toHaveBeenCalledWith('dlq-1');
    });
  });

  describe('retryAll()', () => {
    it('calls service.retryAll with endpoint_id query param', async () => {
      mockService.retryAll.mockResolvedValue({ count: 5 });

      const result = await controller.retryAll('ep-01JHQ');

      expect(result).toEqual({ count: 5 });
      expect(mockService.retryAll).toHaveBeenCalledWith('ep-01JHQ');
    });

    it('throws BadRequestException when endpoint_id is missing', async () => {
      await expect(controller.retryAll(undefined)).rejects.toThrow(BadRequestException);
    });
  });

  describe('purge()', () => {
    it('calls service.purgeByEndpointId when x-confirm header is true', async () => {
      mockService.purgeByEndpointId.mockResolvedValue(undefined);

      const result = await controller.purge('true', 'ep-01JHQ');

      expect(result).toBeUndefined();
      expect(mockService.purgeByEndpointId).toHaveBeenCalledWith('ep-01JHQ');
    });

    it('throws BadRequestException when x-confirm header is missing', async () => {
      await expect(controller.purge(undefined, 'ep-01JHQ')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when x-confirm header is not true', async () => {
      await expect(controller.purge('false', 'ep-01JHQ')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when endpoint_id query is missing', async () => {
      await expect(controller.purge('true', undefined)).rejects.toThrow(BadRequestException);
    });
  });
});
