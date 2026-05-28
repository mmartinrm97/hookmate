import { describe, expect, it, vi } from 'vitest';
import { RedisCircuitBreakerService } from './redis-circuit-breaker.service';
import type { CircuitCheckResult, CircuitStatus } from './circuit-breaker.types';

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  zadd: vi.fn(),
  zcard: vi.fn(),
  zrangebyscore: vi.fn(),
  zremrangebyscore: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};

function createService(): RedisCircuitBreakerService {
  return new RedisCircuitBreakerService(mockRedis as unknown as import('ioredis').Redis);
}

function makeWindowKey(endpointId: string): string {
  return `hookmate:cb:window:${endpointId}`;
}

function makeStateKey(endpointId: string): string {
  return `hookmate:cb:state:${endpointId}`;
}

describe('RedisCircuitBreakerService', () => {
  const endpointId = '01JQTEST_ENDPOINT_X';
  const windowKey = makeWindowKey(endpointId);
  const stateKey = makeStateKey(endpointId);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('checkState()', () => {
    it('returns closed when no state key exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await createService().checkState(endpointId);

      expect(mockRedis.get).toHaveBeenCalledWith(stateKey);
      expect(result).toEqual<CircuitCheckResult>({ state: 'closed', canProceed: true });
    });

    it('returns open when state key is open', async () => {
      mockRedis.get.mockResolvedValue('open');

      const result = await createService().checkState(endpointId);

      expect(result).toEqual<CircuitCheckResult>({ state: 'open', canProceed: false });
    });

    it('returns half-open when state key is half-open', async () => {
      mockRedis.get.mockResolvedValue('half-open');

      const result = await createService().checkState(endpointId);

      expect(result).toEqual<CircuitCheckResult>({ state: 'half-open', canProceed: true });
    });

    it('fails-open on Redis error (returns closed with canProceed true)', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      const result = await createService().checkState(endpointId);

      expect(result).toEqual<CircuitCheckResult>({ state: 'closed', canProceed: true });
    });
  });

  describe('recordSuccess()', () => {
    it('deletes state and window keys when transitioning from half-open to closed', async () => {
      mockRedis.get.mockResolvedValue('half-open');
      mockRedis.del.mockResolvedValue(2);

      await createService().recordSuccess(endpointId);

      expect(mockRedis.del).toHaveBeenCalledWith(stateKey, windowKey);
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('adds to window with :1 suffix when circuit is closed', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const before = Date.now();
      await createService().recordSuccess(endpointId);
      const after = Date.now();

      expect(mockRedis.zadd).toHaveBeenCalledTimes(1);
      const zaddCall = mockRedis.zadd.mock.calls[0] as [string, number, string];
      expect(zaddCall[0]).toBe(windowKey);
      expect(zaddCall[1]).toBeGreaterThanOrEqual(before);
      expect(zaddCall[1]).toBeLessThanOrEqual(after);
      expect(zaddCall[2]).toMatch(/:\d+$/);
      expect(zaddCall[2]).toMatch(/:1$/);

      expect(mockRedis.expire).toHaveBeenCalledWith(windowKey, 300);
    });

    it('fails gracefully on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      await expect(createService().recordSuccess(endpointId)).resolves.toBeUndefined();
    });
  });

  describe('recordFailure()', () => {
    it('re-opens circuit when in half-open state', async () => {
      mockRedis.get.mockResolvedValue('half-open');
      mockRedis.set.mockResolvedValue('OK');

      await createService().recordFailure(endpointId);

      expect(mockRedis.set).toHaveBeenCalledWith(stateKey, 'open', 'EX', 120);
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('adds to window with :0 suffix and does NOT open when below threshold', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zrangebyscore.mockResolvedValue(['1', '2']);
      mockRedis.expire.mockResolvedValue(1);

      await createService().recordFailure(endpointId);

      const zaddCall = mockRedis.zadd.mock.calls[0] as [string, number, string];
      expect(zaddCall[0]).toBe(windowKey);
      expect(zaddCall[2]).toMatch(/:0$/);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('opens circuit when failureRate reaches threshold', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zrangebyscore.mockResolvedValue([
        '1748000000000:1',
        '1748000000001:1',
        '1748000000002:0',
        '1748000000003:0',
        '1748000000004:0',
        '1748000000005:0',
        '1748000000006:0',
        '1748000000007:0',
        '1748000000008:0',
        '1748000000009:0',
      ]);
      mockRedis.set.mockResolvedValue('OK');

      await createService().recordFailure(endpointId);

      expect(mockRedis.set).toHaveBeenCalledWith(stateKey, 'open', 'EX', 120);
    });

    it('does NOT open circuit with empty window', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zrangebyscore.mockResolvedValue([]);

      await createService().recordFailure(endpointId);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('fails gracefully on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      await expect(createService().recordFailure(endpointId)).resolves.toBeUndefined();
    });

    it('uses custom options for threshold, window and cooldown', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(5);
      mockRedis.zrangebyscore.mockResolvedValue(['1:0', '2:0', '3:0', '4:0', '5:0']);
      mockRedis.set.mockResolvedValue('OK');

      await createService().recordFailure(endpointId, {
        failureThreshold: 0.5,
        windowSeconds: 60,
        cooldownSeconds: 300,
      });

      expect(mockRedis.set).toHaveBeenCalledWith(stateKey, 'open', 'EX', 300);
    });
  });

  describe('reset()', () => {
    it('deletes both state and window keys', async () => {
      mockRedis.del.mockResolvedValue(2);

      await createService().reset(endpointId);

      expect(mockRedis.del).toHaveBeenCalledWith(stateKey, windowKey);
    });
  });

  describe('getStatus()', () => {
    it('returns full status when circuit is open with TTL', async () => {
      mockRedis.get.mockResolvedValue('open');
      mockRedis.ttl.mockResolvedValue(45);
      mockRedis.zremrangebyscore.mockResolvedValue(3);
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zrangebyscore.mockResolvedValue([
        '1:0',
        '2:0',
        '3:0',
        '4:0',
        '5:0',
        '6:0',
        '7:0',
        '8:0',
        '9:1',
        '10:1',
      ]);

      const status = await createService().getStatus(endpointId);

      expect(status).toEqual<CircuitStatus>({
        state: 'open',
        failureRate: 0.8,
        windowSeconds: 300,
        cooldownRemainingSeconds: 45,
      });
    });

    it('returns closed status when no state key exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.ttl.mockResolvedValue(-2);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zrangebyscore.mockResolvedValue([]);

      const status = await createService().getStatus(endpointId);

      expect(status).toEqual<CircuitStatus>({
        state: 'closed',
        failureRate: null,
        windowSeconds: 300,
        cooldownRemainingSeconds: null,
      });
    });

    it('evicts stale entries before counting', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.ttl.mockResolvedValue(-2);
      mockRedis.zremrangebyscore.mockResolvedValue(5);
      mockRedis.zcard.mockResolvedValue(8);
      mockRedis.zrangebyscore.mockResolvedValue([
        'a:0',
        'b:0',
        'c:1',
        'd:1',
        'e:1',
        'f:1',
        'g:1',
        'h:1',
      ]);

      await createService().getStatus(endpointId);

      const now = Date.now();
      const expectedCutoff = now - 300 * 1000;
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(windowKey, '-inf', expectedCutoff);
    });
  });
});
