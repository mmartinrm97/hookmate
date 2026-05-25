import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiProcessorService } from './ai-processor.service';

// Mock the Vercel AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

import { generateText } from 'ai';

function makeEvents(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `evt-${i}`,
    status: i % 3 === 0 ? 'failed' : 'delivered',
    category: i < 3 ? null : `payment.charge`,
    payload: { amount: 100, currency: 'USD' },
    receivedAt: `2026-01-15T${String(10 + i).padStart(2, '0')}:00:00Z`,
  }));
}

function makeClassificationInput(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    eventId: `evt-${i}`,
    payload: { amount: 100, currency: 'USD' },
    receivedAt: `2026-01-15T${String(10 + i).padStart(2, '0')}:00:00Z`,
  }));
}

describe('AiProcessorService', () => {
  let service: AiProcessorService;
  let mockConfig: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockConfig = { get: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiProcessorService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    service = module.get<AiProcessorService>(AiProcessorService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSummary', () => {
    it('returns parsed SummaryResponse when AI returns valid JSON', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({
          summaryText: 'Most events succeeded with a few payment failures.',
          eventCount: 6,
          failureCount: 2,
          topCategories: { 'payment.charge': 4, 'auth.login': 2 },
        }),
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        warnings: [],
        response: { id: 'resp-1', timestamp: new Date(), modelId: 'gpt-4o-mini' },
        steps: [],
        experimental_output: undefined,
      } as never);

      const result = await service.generateSummary(
        { name: 'test-endpoint', id: 'ep-01JHQ' },
        makeEvents(6),
      );

      expect(result).toEqual({
        summaryText: 'Most events succeeded with a few payment failures.',
        eventCount: 6,
        failureCount: 2,
        topCategories: { 'payment.charge': 4, 'auth.login': 2 },
      });
    });

    it('returns null when OPENAI_API_KEY is not set', async () => {
      mockConfig.get.mockReturnValue(undefined);

      const result = await service.generateSummary(
        { name: 'test-endpoint', id: 'ep-01JHQ' },
        makeEvents(3),
      );

      expect(result).toBeNull();
      expect(generateText).not.toHaveBeenCalled();
    });

    it('returns null when OPENAI_API_KEY is empty string', async () => {
      mockConfig.get.mockReturnValue('');

      const result = await service.generateSummary(
        { name: 'test-endpoint', id: 'ep-01JHQ' },
        makeEvents(3),
      );

      expect(result).toBeNull();
      expect(generateText).not.toHaveBeenCalled();
    });

    it('returns null when AI provider throws a network error', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockRejectedValue(new Error('Network error'));

      const result = await service.generateSummary(
        { name: 'test-endpoint', id: 'ep-01JHQ' },
        makeEvents(3),
      );

      expect(result).toBeNull();
    });

    it('returns null when AI returns malformed JSON', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockResolvedValue({
        text: 'This is not JSON at all',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
        warnings: [],
        response: { id: 'resp-2', timestamp: new Date(), modelId: 'gpt-4o-mini' },
        steps: [],
        experimental_output: undefined,
      } as never);

      const result = await service.generateSummary(
        { name: 'test-endpoint', id: 'ep-01JHQ' },
        makeEvents(3),
      );

      expect(result).toBeNull();
    });

    it('returns null when AI response has wrong structure (missing fields)', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      // Valid JSON but missing required fields
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({ summaryText: 'Only summary' }),
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
        warnings: [],
        response: { id: 'resp-3', timestamp: new Date(), modelId: 'gpt-4o-mini' },
        steps: [],
        experimental_output: undefined,
      } as never);

      const result = await service.generateSummary(
        { name: 'test-endpoint', id: 'ep-01JHQ' },
        makeEvents(3),
      );

      expect(result).toBeNull();
    });

    it('returns null when AI returns empty events array', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');

      const result = await service.generateSummary({ name: 'test-endpoint', id: 'ep-01JHQ' }, []);

      expect(result).toBeNull();
      expect(generateText).not.toHaveBeenCalled();
    });

    it('calls generateText with openai model and the summary system prompt', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({
          summaryText: 'Summary',
          eventCount: 1,
          failureCount: 0,
          topCategories: {},
        }),
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        warnings: [],
        response: { id: 'resp-4', timestamp: new Date(), modelId: 'gpt-4o-mini' },
        steps: [],
        experimental_output: undefined,
      } as never);

      await service.generateSummary({ name: 'test-endpoint', id: 'ep-01JHQ' }, makeEvents(2));

      expect(generateText).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(generateText).mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs.system).toContain('Return ONLY valid JSON');
      expect(callArgs.temperature).toBe(0.3);
    });
  });

  describe('classifyEvents', () => {
    it('returns classification items when AI returns valid JSON array', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify([
          { eventId: 'evt-0', category: 'payment.charge' },
          { eventId: 'evt-1', category: 'auth.login' },
          { eventId: 'evt-2', category: 'user.signup' },
        ]),
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 80, completionTokens: 30, totalTokens: 110 },
        warnings: [],
        response: { id: 'resp-5', timestamp: new Date(), modelId: 'gpt-4o-mini' },
        steps: [],
        experimental_output: undefined,
      } as never);

      const events = makeClassificationInput(3);
      const result = await service.classifyEvents(events);

      expect(result).toHaveLength(3);
      expect(result?.[0]).toEqual({ eventId: 'evt-0', category: 'payment.charge' });
    });

    it('returns null when AI provider errors', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockRejectedValue(new Error('API error'));

      const result = await service.classifyEvents([
        { eventId: 'evt-0', payload: {}, receivedAt: '2026-01-15T12:00:00Z' },
      ]);

      expect(result).toBeNull();
    });

    it('returns null when OPENAI_API_KEY is missing', async () => {
      mockConfig.get.mockReturnValue(undefined);

      const result = await service.classifyEvents([
        { eventId: 'evt-0', payload: {}, receivedAt: '2026-01-15T12:00:00Z' },
      ]);

      expect(result).toBeNull();
      expect(generateText).not.toHaveBeenCalled();
    });

    it('returns null when AI returns malformed JSON', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockResolvedValue({
        text: 'not-json',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
        warnings: [],
        response: { id: 'resp-6', timestamp: new Date(), modelId: 'gpt-4o-mini' },
        steps: [],
        experimental_output: undefined,
      } as never);

      const result = await service.classifyEvents([
        { eventId: 'evt-0', payload: {}, receivedAt: '2026-01-15T12:00:00Z' },
      ]);

      expect(result).toBeNull();
    });

    it('filters out items with empty or missing category field', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify([
          { eventId: 'evt-0', category: 'payment.charge' },
          { eventId: 'evt-1', category: '' },
          { eventId: 'evt-2' },
        ]),
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 80, completionTokens: 30, totalTokens: 110 },
        warnings: [],
        response: { id: 'resp-7', timestamp: new Date(), modelId: 'gpt-4o-mini' },
        steps: [],
        experimental_output: undefined,
      } as never);

      const result = await service.classifyEvents([
        { eventId: 'evt-0', payload: {}, receivedAt: '' },
        { eventId: 'evt-1', payload: {}, receivedAt: '' },
        { eventId: 'evt-2', payload: {}, receivedAt: '' },
      ]);

      expect(result).toHaveLength(1);
      expect(result?.[0]).toEqual({ eventId: 'evt-0', category: 'payment.charge' });
    });

    it('returns null when empty events array is passed', async () => {
      mockConfig.get.mockReturnValue('sk-test-key');

      const result = await service.classifyEvents([]);

      expect(result).toBeNull();
      expect(generateText).not.toHaveBeenCalled();
    });
  });
});
