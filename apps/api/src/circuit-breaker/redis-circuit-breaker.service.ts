import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './circuit-breaker.types';
import type { CircuitCheckResult, CircuitStatus, ICircuitBreaker } from './circuit-breaker.types';

const DEFAULT_FAILURE_THRESHOLD = 0.8;
const DEFAULT_WINDOW_SECONDS = 300;
const DEFAULT_COOLDOWN_SECONDS = 120;

export interface CbOptions {
  failureThreshold: number;
  windowSeconds: number;
  cooldownSeconds: number;
}

function makeWindowKey(endpointId: string): string {
  return `hookmate:cb:window:${endpointId}`;
}

function makeStateKey(endpointId: string): string {
  return `hookmate:cb:state:${endpointId}`;
}

@Injectable()
export class RedisCircuitBreakerService implements ICircuitBreaker {
  private readonly logger = new Logger(RedisCircuitBreakerService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async checkState(endpointId: string): Promise<CircuitCheckResult> {
    try {
      const stateKey = makeStateKey(endpointId);
      const state = await this.redis.get(stateKey);

      if (state === 'open') {
        return { state: 'open', canProceed: false };
      }

      if (state === 'half-open') {
        return { state: 'half-open', canProceed: true };
      }

      return { state: 'closed', canProceed: true };
    } catch (error) {
      this.logger.warn(
        `Circuit breaker check failed for ${endpointId} — failing open: ${(error as Error).message}`,
      );
      return { state: 'closed', canProceed: true };
    }
  }

  async recordSuccess(endpointId: string): Promise<void> {
    try {
      const stateKey = makeStateKey(endpointId);
      const windowKey = makeWindowKey(endpointId);
      const state = await this.redis.get(stateKey);

      if (state === 'half-open') {
        await this.redis.del(stateKey, windowKey);
        this.logger.log(`Circuit closed for endpoint ${endpointId} (probe success)`);
        return;
      }

      const now = Date.now();
      const member = `${now}:1`;
      await this.redis.zadd(windowKey, now, member);
      await this.redis.expire(windowKey, DEFAULT_WINDOW_SECONDS);
    } catch (error) {
      this.logger.warn(`Failed to record success for ${endpointId}: ${(error as Error).message}`);
    }
  }

  async recordFailure(endpointId: string, options?: Partial<CbOptions>): Promise<void> {
    try {
      const stateKey = makeStateKey(endpointId);
      const windowKey = makeWindowKey(endpointId);
      const state = await this.redis.get(stateKey);

      const threshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
      const windowSeconds = options?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
      const cooldownSeconds = options?.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;

      if (state === 'half-open') {
        await this.redis.set(stateKey, 'open', 'EX', cooldownSeconds);
        this.logger.log(`Circuit re-opened for endpoint ${endpointId} (probe failure)`);
        return;
      }

      const now = Date.now();
      const member = `${now}:0`;
      await this.redis.zadd(windowKey, now, member);
      await this.redis.expire(windowKey, windowSeconds);

      const windowStart = now - windowSeconds * 1000;
      await this.redis.zremrangebyscore(windowKey, '-inf', windowStart);

      const total = await this.redis.zcard(windowKey);
      if (total === 0) {
        return;
      }

      const members = await this.redis.zrangebyscore(windowKey, windowStart, '+inf');
      const failures = members.filter((m: string) => m.endsWith(':0')).length;
      const failureRate = failures / total;

      if (failureRate >= threshold) {
        await this.redis.set(stateKey, 'open', 'EX', cooldownSeconds);
        this.logger.warn(
          `Circuit opened for endpoint ${endpointId}: ${failures}/${total} (${(failureRate * 100).toFixed(1)}% failure rate)`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to record failure for ${endpointId}: ${(error as Error).message}`);
    }
  }

  async reset(endpointId: string): Promise<void> {
    const stateKey = makeStateKey(endpointId);
    const windowKey = makeWindowKey(endpointId);
    await this.redis.del(stateKey, windowKey);
    this.logger.log(`Circuit reset for endpoint ${endpointId}`);
  }

  async getStatus(endpointId: string): Promise<CircuitStatus> {
    const stateKey = makeStateKey(endpointId);
    const windowKey = makeWindowKey(endpointId);

    const stateRaw = await this.redis.get(stateKey);
    const state: CircuitStatus['state'] =
      stateRaw === 'open' ? 'open' : stateRaw === 'half-open' ? 'half-open' : 'closed';

    const now = Date.now();
    const windowSeconds = DEFAULT_WINDOW_SECONDS;
    const windowStart = now - windowSeconds * 1000;

    await this.redis.zremrangebyscore(windowKey, '-inf', windowStart);
    const total = await this.redis.zcard(windowKey);

    let failureRate: number | null = null;
    if (total > 0) {
      const members = await this.redis.zrangebyscore(windowKey, windowStart, '+inf');
      const failures = members.filter((m: string) => m.endsWith(':0')).length;
      failureRate = failures / total;
    }

    let cooldownRemainingSeconds: number | null = null;
    if (state === 'open') {
      const ttl = await this.redis.ttl(stateKey);
      cooldownRemainingSeconds = ttl > 0 ? ttl : null;
    }

    return {
      state,
      failureRate,
      windowSeconds,
      cooldownRemainingSeconds,
    };
  }
}
