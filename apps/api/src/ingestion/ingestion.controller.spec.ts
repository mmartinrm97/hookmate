import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

describe('IngestionController', () => {
  let controller: IngestionController;
  let mockIngestionService: {
    ingest: ReturnType<typeof vi.fn>;
  };
  let mockFastifyInstance: {
    post: ReturnType<typeof vi.fn>;
    addContentTypeParser: ReturnType<typeof vi.fn>;
    addHook: ReturnType<typeof vi.fn>;
  };
  let mockHttpAdapterHost: {
    httpAdapter: {
      getInstance: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockIngestionService = {
      ingest: vi.fn(),
    };
    mockFastifyInstance = {
      post: vi.fn(),
      addContentTypeParser: vi.fn(),
      addHook: vi.fn(),
    };
    mockHttpAdapterHost = {
      httpAdapter: {
        getInstance: vi.fn().mockReturnValue(mockFastifyInstance),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionController,
        { provide: IngestionService, useValue: mockIngestionService },
        { provide: HttpAdapterHost, useValue: mockHttpAdapterHost },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
  });

  describe('onApplicationBootstrap', () => {
    it('registers a POST route at /webhooks/:endpointId with bodyLimit', () => {
      controller.onApplicationBootstrap();

      expect(mockFastifyInstance.post).toHaveBeenCalledWith(
        '/webhooks/:endpointId',
        { bodyLimit: 10_485_760 },
        expect.any(Function),
      );
    });

    it('registers a preParsing hook to capture raw body', () => {
      controller.onApplicationBootstrap();

      expect(mockFastifyInstance.addHook).toHaveBeenCalledWith('preParsing', expect.any(Function));
    });
  });

  describe('route handler (when called by Fastify)', () => {
    let requestMock: {
      params: Record<string, string>;
      body: Buffer;
      headers: Record<string, string>;
      ip: string;
    };
    let replyMock: {
      status: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      requestMock = {
        params: { endpointId: 'ep-01JHQ' },
        body: Buffer.from(JSON.stringify({ event: 'test' })),
        headers: { 'x-hub-signature-256': 'sha256=abc123' },
        ip: '10.0.0.1',
      };
      replyMock = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
    });

    it('returns 202 with event_id, trace_id, and received_at on success', async () => {
      const expectedResult = {
        event_id: 'evt-01JHQ',
        trace_id: 'trace-ulid-001',
        received_at: '2026-01-15T12:00:05Z',
      };
      mockIngestionService.ingest.mockResolvedValue(expectedResult);

      // Trigger route registration to capture the handler
      controller.onApplicationBootstrap();
      const handler = mockFastifyInstance.post.mock.calls[0]?.[2];

      await handler(requestMock, replyMock);

      expect(replyMock.status).toHaveBeenCalledWith(202);
      expect(replyMock.send).toHaveBeenCalledWith(expectedResult);
      expect(mockIngestionService.ingest).toHaveBeenCalledWith({
        endpointId: 'ep-01JHQ',
        rawBody: expect.any(Buffer),
        headers: requestMock.headers,
        sourceIp: '10.0.0.1',
        signature: 'sha256=abc123',
      });
    });

    it('returns 202 with X-Forwarded-For when ip is not available', async () => {
      requestMock.ip = '';
      requestMock.headers = { 'x-forwarded-for': '192.168.1.100' };
      mockIngestionService.ingest.mockResolvedValue({
        event_id: 'evt-01JHQ',
        trace_id: 'trace-ulid-001',
        received_at: '2026-01-15T12:00:05Z',
      });

      controller.onApplicationBootstrap();
      const handler = mockFastifyInstance.post.mock.calls[0]?.[2];

      await handler(requestMock, replyMock);

      expect(mockIngestionService.ingest).toHaveBeenCalledWith(
        expect.objectContaining({ sourceIp: '192.168.1.100' }),
      );
    });

    it('maps NotFoundException to 404 response', async () => {
      mockIngestionService.ingest.mockRejectedValue(new NotFoundException('Endpoint not found'));

      controller.onApplicationBootstrap();
      const handler = mockFastifyInstance.post.mock.calls[0]?.[2];

      await handler(requestMock, replyMock);

      expect(replyMock.status).toHaveBeenCalledWith(404);
    });

    it('maps BadRequestException to 400 response', async () => {
      mockIngestionService.ingest.mockRejectedValue(new BadRequestException('invalid_signature'));

      controller.onApplicationBootstrap();
      const handler = mockFastifyInstance.post.mock.calls[0]?.[2];

      await handler(requestMock, replyMock);

      expect(replyMock.status).toHaveBeenCalledWith(400);
    });

    it('maps ConflictException to 409 response', async () => {
      mockIngestionService.ingest.mockRejectedValue(new ConflictException('Endpoint is paused'));

      controller.onApplicationBootstrap();
      const handler = mockFastifyInstance.post.mock.calls[0]?.[2];

      await handler(requestMock, replyMock);

      expect(replyMock.status).toHaveBeenCalledWith(409);
    });

    it('maps ServiceUnavailableException to 503 response', async () => {
      mockIngestionService.ingest.mockRejectedValue(new ServiceUnavailableException('DB failure'));

      controller.onApplicationBootstrap();
      const handler = mockFastifyInstance.post.mock.calls[0]?.[2];

      await handler(requestMock, replyMock);

      expect(replyMock.status).toHaveBeenCalledWith(503);
    });

    it('handles requests without signature header', async () => {
      requestMock.headers = {};
      mockIngestionService.ingest.mockResolvedValue({
        event_id: 'evt-01JHQ',
        trace_id: 'trace-ulid-001',
        received_at: '2026-01-15T12:00:05Z',
      });

      controller.onApplicationBootstrap();
      const handler = mockFastifyInstance.post.mock.calls[0]?.[2];

      await handler(requestMock, replyMock);

      expect(replyMock.status).toHaveBeenCalledWith(202);
      expect(mockIngestionService.ingest).toHaveBeenCalledWith(
        expect.objectContaining({ signature: undefined }),
      );
    });
  });
});
