import { describe, expect, it, vi } from 'vitest';

const mockGetCalls: Array<{ url: string }> = [];

vi.mock('@nestjs/core', () => ({
  HttpAdapterHost: class {},
}));

vi.mock('@nestjs/common', async () => {
  const actual = await vi.importActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    ...actual,
    Logger: class {
      debug() {}
      warn() {}
      error() {}
    },
  };
});

// Import after mocks are set up
import { MetricsSseHandler } from './metrics-sse.handler';

describe('MetricsSseHandler', () => {
  describe('onApplicationBootstrap()', () => {
    it('registers a GET handler for /api/metrics/stream', () => {
      mockGetCalls.length = 0;

      const mockSqsService = {
        getQueueDepth: vi.fn().mockResolvedValue({ visible: 0, invisible: 0, delayed: 0 }),
      };
      const mockHttpAdapterHost = {
        httpAdapter: {
          getInstance: () => ({
            get: (url: string) => {
              mockGetCalls.push({ url });
            },
          }),
        },
      };

      const handler = new MetricsSseHandler(mockHttpAdapterHost as never, mockSqsService as never);

      handler.onApplicationBootstrap();

      expect(mockGetCalls).toHaveLength(1);
      expect(mockGetCalls[0]?.url).toBe('/api/metrics/stream');
    });
  });
});
