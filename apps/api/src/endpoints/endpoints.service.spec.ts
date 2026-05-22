import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EndpointsService } from './endpoints.service.js';
import { Endpoint } from './entities/endpoint.entity.js';
import type { HookMateEndpoint } from '@hookmate/shared';

function createMockEntity(overrides: Partial<Endpoint> = {}): Endpoint {
  const now = new Date('2026-01-15T12:00:00Z');

  return {
    id: '01JHQABC123DEF456GHI789JK',
    name: 'Test webhook',
    destinationUrl: 'https://example.com/webhook',
    status: 'active' as const,
    maxRetries: 5,
    retryBaseDelayMs: 5000,
    dlqThreshold: 100,
    secret: undefined,
    createdAt: now,
    updatedAt: now,
    toPrimitive(this: Endpoint): HookMateEndpoint {
      return {
        id: this.id,
        name: this.name,
        destinationUrl: this.destinationUrl,
        secret: this.secret ?? undefined,
        status: this.status,
        maxRetries: this.maxRetries,
        retryBaseDelayMs: this.retryBaseDelayMs,
        dlqThreshold: this.dlqThreshold,
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString(),
      };
    },
    ...overrides,
  } as unknown as Endpoint;
}

describe('EndpointsService', () => {
  let service: EndpointsService;
  let mockRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndpointsService,
        {
          provide: getRepositoryToken(Endpoint),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<EndpointsService>(EndpointsService);
  });

  describe('list()', () => {
    it('returns empty array when no endpoints exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });

    it('returns all endpoints ordered by createdAt DESC', async () => {
      const entity1 = createMockEntity({ id: 'entity-1', name: 'First' });
      const entity2 = createMockEntity({ id: 'entity-2', name: 'Second' });
      mockRepo.find.mockResolvedValue([entity1, entity2]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('entity-1');
      expect(result[1]?.id).toBe('entity-2');
    });
  });

  describe('getById()', () => {
    it('returns the endpoint when found', async () => {
      const entity = createMockEntity({ id: 'existing-id' });
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById('existing-id');

      expect(result.id).toBe('existing-id');
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'existing-id' } });
    });

    it('throws NotFoundException when endpoint does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('creates and returns a new endpoint', async () => {
      const entity = createMockEntity();
      const input = {
        name: 'New endpoint',
        destinationUrl: 'https://example.com/new',
      };

      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create(input);

      expect(result.name).toBe('Test webhook');
      expect(result.destinationUrl).toBe('https://example.com/webhook');
      expect(result.status).toBe('active');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New endpoint',
          destinationUrl: 'https://example.com/new',
          status: 'active',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(entity);
    });

    it('throws BadRequestException when name is empty', async () => {
      await expect(
        service.create({
          name: '   ',
          destinationUrl: 'https://example.com/webhook',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when destination URL is empty', async () => {
      await expect(
        service.create({
          name: 'Valid name',
          destinationUrl: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when destination URL is invalid', async () => {
      await expect(
        service.create({
          name: 'Valid name',
          destinationUrl: 'not-a-url',
        }),
      ).rejects.toThrow('Destination URL must be a valid absolute URL');
    });

    it('throws BadRequestException when destination URL uses invalid protocol', async () => {
      await expect(
        service.create({
          name: 'Valid name',
          destinationUrl: 'ftp://example.com/webhook',
        }),
      ).rejects.toThrow('Destination URL must use HTTP or HTTPS');
    });
  });

  describe('pause()', () => {
    it('pauses an active endpoint', async () => {
      const entity = createMockEntity({ status: 'active' as const });
      const pausedEntity = createMockEntity({ status: 'paused' as const });
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.save.mockResolvedValue(pausedEntity);

      const result = await service.pause('test-id');

      expect(result.status).toBe('paused');
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-id' } });
    });

    it('throws NotFoundException when endpoint does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.pause('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when endpoint is not active', async () => {
      const entity = createMockEntity({ status: 'paused' as const });
      mockRepo.findOne.mockResolvedValue(entity);

      await expect(service.pause('paused-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resume()', () => {
    it('resumes a paused endpoint', async () => {
      const entity = createMockEntity({ status: 'paused' as const });
      const resumedEntity = createMockEntity({ status: 'active' as const });
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.save.mockResolvedValue(resumedEntity);

      const result = await service.resume('test-id');

      expect(result.status).toBe('active');
    });

    it('throws NotFoundException when endpoint does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.resume('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when endpoint is not paused', async () => {
      const entity = createMockEntity({ status: 'active' as const });
      mockRepo.findOne.mockResolvedValue(entity);

      await expect(service.resume('active-id')).rejects.toThrow(BadRequestException);
    });
  });
});
