import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DeliveryService } from './delivery.service';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('DeliveryService', () => {
  let service: DeliveryService;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPost = vi.fn();
    (axios as unknown as { post: typeof mockPost }).post = mockPost;
    service = new DeliveryService();
  });

  describe('successful POST', () => {
    it('returns success result when destination returns 200', async () => {
      mockPost.mockResolvedValue({ status: 200, data: { ok: true } });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('success');
      expect(result.httpStatus).toBe(200);
      expect(result.responseBody).toBe(JSON.stringify({ ok: true }));
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns success result when destination returns 201', async () => {
      mockPost.mockResolvedValue({ status: 201, data: 'created' });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('success');
      expect(result.httpStatus).toBe(201);
    });

    it('returns success result when destination returns 299', async () => {
      mockPost.mockResolvedValue({ status: 299, data: null });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('success');
      expect(result.httpStatus).toBe(299);
    });
  });

  describe('non-2xx response', () => {
    it('returns failed result when destination returns 400', async () => {
      mockPost.mockRejectedValue({ response: { status: 400 }, code: 'ERR_BAD_REQUEST' });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('failed');
      expect(result.httpStatus).toBe(400);
      expect(result.responseBody).toBeNull();
    });

    it('returns failed result when destination returns 503', async () => {
      mockPost.mockRejectedValue({ response: { status: 503 }, code: 'ERR_BAD_RESPONSE' });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('failed');
      expect(result.httpStatus).toBe(503);
    });
  });

  describe('timeout handling', () => {
    it('returns timeout result when axios timeout occurs', async () => {
      mockPost.mockRejectedValue({ code: 'ECONNABORTED' });

      const result = await service.deliver(
        'https://slow.example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('timeout');
      expect(result.httpStatus).toBeNull();
      expect(result.responseBody).toBeNull();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('network error handling', () => {
    it('returns failed result on DNS failure', async () => {
      mockPost.mockRejectedValue(new Error('getaddrinfo ENOTFOUND nonexistent.example.com'));

      const result = await service.deliver(
        'https://nonexistent.example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('failed');
      expect(result.httpStatus).toBeNull();
      expect(result.responseBody).toBeNull();
    });

    it('returns failed result on connection refused', async () => {
      mockPost.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8080'));

      const result = await service.deliver(
        'http://localhost:8080/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('failed');
      expect(result.httpStatus).toBeNull();
    });

    it('returns failed result on generic error with null httpStatus', async () => {
      mockPost.mockRejectedValue(new Error('Something went wrong'));

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.status).toBe('failed');
      expect(result.httpStatus).toBeNull();
    });
  });

  describe('X-HookMate-Event-Id header', () => {
    it('includes X-HookMate-Event-Id header in the POST request', async () => {
      mockPost.mockResolvedValue({ status: 200, data: { ok: true } });

      await service.deliver('https://example.com/hook', { event: 'test' }, 'ev-01JHQ');

      expect(mockPost).toHaveBeenCalledWith(
        'https://example.com/hook',
        { event: 'test' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-HookMate-Event-Id': 'ev-01JHQ',
          }),
        }),
      );
    });

    it('includes Content-Type application/json header', async () => {
      mockPost.mockResolvedValue({ status: 200, data: { ok: true } });

      await service.deliver('https://example.com/hook', { event: 'test' }, 'ev-01JHQ');

      expect(mockPost).toHaveBeenCalledWith(
        'https://example.com/hook',
        { event: 'test' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('timeout configuration', () => {
    it('sets 10s timeout on axios request', async () => {
      mockPost.mockResolvedValue({ status: 200, data: { ok: true } });

      await service.deliver('https://example.com/hook', { event: 'test' }, 'ev-01JHQ');

      expect(mockPost).toHaveBeenCalledWith(
        'https://example.com/hook',
        { event: 'test' },
        expect.objectContaining({
          timeout: 10_000,
        }),
      );
    });
  });

  describe('response body truncation', () => {
    it('returns null responseBody when data is null', async () => {
      mockPost.mockResolvedValue({ status: 200, data: null });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.responseBody).toBeNull();
    });

    it('returns null responseBody when data is undefined', async () => {
      mockPost.mockResolvedValue({ status: 200, data: undefined });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.responseBody).toBeNull();
    });

    it('truncates response body to 4096 characters when larger', async () => {
      const longString = 'x'.repeat(5000);
      mockPost.mockResolvedValue({ status: 200, data: longString });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.responseBody).toHaveLength(4096);
      expect(result.responseBody).toBe('x'.repeat(4096));
    });

    it('does not truncate response body when smaller than 4096', async () => {
      const shortString = 'y'.repeat(100);
      mockPost.mockResolvedValue({ status: 200, data: shortString });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result.responseBody).toHaveLength(100);
      expect(result.responseBody).toBe('y'.repeat(100));
    });
  });

  describe('never throws', () => {
    it('always returns a DeliveryResult on network error', async () => {
      mockPost.mockRejectedValue(new Error('Network is down'));

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('httpStatus');
      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('responseBody');
    });

    it('always returns a DeliveryResult on timeout', async () => {
      mockPost.mockRejectedValue({ code: 'ECONNABORTED' });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('httpStatus');
      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('responseBody');
    });

    it('always returns a DeliveryResult on non-2xx', async () => {
      mockPost.mockRejectedValue({ response: { status: 500 } });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('httpStatus');
      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('responseBody');
    });

    it('always returns a DeliveryResult on success', async () => {
      mockPost.mockResolvedValue({ status: 200, data: { ok: true } });

      const result = await service.deliver(
        'https://example.com/hook',
        { event: 'test' },
        'ev-01JHQ',
      );

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('httpStatus');
      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('responseBody');
    });
  });
});
