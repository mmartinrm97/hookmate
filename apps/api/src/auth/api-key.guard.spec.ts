import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyGuard } from './api-key.guard';

function createMockConfigService(apiKeys: string): ConfigService {
  return {
    get: vi.fn((key: string) => {
      if (key === 'API_KEYS') return apiKeys;
      return undefined;
    }),
    getOrThrow: vi.fn(),
  } as unknown as ConfigService;
}

function createMockExecutionContext(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization: authorization,
        },
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  describe('canActivate with valid keys', () => {
    let guard: ApiKeyGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new ApiKeyGuard(createMockConfigService('key-123,key-456'), reflector);
    });

    it('returns true for a valid API key', () => {
      const context = createMockExecutionContext('Bearer key-123');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('returns true for any valid API key from the set', () => {
      const context = createMockExecutionContext('Bearer key-456');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('returns false for an invalid API key', () => {
      const context = createMockExecutionContext('Bearer wrong-key');
      expect(guard.canActivate(context)).toBe(false);
    });

    it('returns false when Authorization header is missing', () => {
      const context = createMockExecutionContext(undefined);
      expect(guard.canActivate(context)).toBe(false);
    });

    it('returns false for empty Authorization header', () => {
      const context = createMockExecutionContext('Bearer ');
      expect(guard.canActivate(context)).toBe(false);
    });

    it('returns false for malformed Authorization scheme', () => {
      const context = createMockExecutionContext('Basic key-123');
      expect(guard.canActivate(context)).toBe(false);
    });
  });

  describe('canActivate with @Public() decorator', () => {
    it('returns true for public routes even without API key', () => {
      const reflector = new Reflector();
      const guard = new ApiKeyGuard(createMockConfigService('key-123'), reflector);

      const context = createMockExecutionContext(undefined);
      vi.spyOn(reflector, 'get').mockReturnValue(true);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('returns true for public routes even with invalid API key', () => {
      const reflector = new Reflector();
      const guard = new ApiKeyGuard(createMockConfigService('key-123'), reflector);

      const context = createMockExecutionContext('Bearer invalid');
      vi.spyOn(reflector, 'get').mockReturnValue(true);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('canActivate with empty API_KEYS', () => {
    it('rejects all requests when no keys configured', () => {
      const reflector = new Reflector();
      const guard = new ApiKeyGuard(createMockConfigService(''), reflector);

      const context = createMockExecutionContext('Bearer any-key');
      expect(guard.canActivate(context)).toBe(false);
    });
  });

  describe('canActivate with single trailing comma', () => {
    it('ignores empty entries from trailing comma', () => {
      const reflector = new Reflector();
      const guard = new ApiKeyGuard(createMockConfigService('key-123,'), reflector);

      const context = createMockExecutionContext('Bearer key-123');
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
