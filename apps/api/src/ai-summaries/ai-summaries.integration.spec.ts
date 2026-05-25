import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock AI SDK at the top level
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

import { getQueueToken } from '@nestjs/bull';
import { generateText } from 'ai';
import { AiProcessorService } from './ai-processor.service';
import { AiSummariesConsumer } from './ai-summaries.consumer';
import { AiSummariesService } from './ai-summaries.service';
import { EventsService } from '../events/events.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import type { AiSummaryJobData } from './ai-summaries.types';

describe('AI Summaries Integration', () => {
  let consumer: AiSummariesConsumer;
  let mockAiSummariesService: { upsert: ReturnType<typeof vi.fn> };
  let mockEventsService: {
    listFiltered: ReturnType<typeof vi.fn>;
    getUncategorizedEvents: ReturnType<typeof vi.fn>;
    batchUpdateCategories: ReturnType<typeof vi.fn>;
  };
  let mockEndpointsService: { list: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn> };
  let mockConfig: { get: ReturnType<typeof vi.fn> };
  let mockQueue: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAiSummariesService = {
      upsert: vi.fn().mockResolvedValue({}),
    };
    mockEventsService = {
      listFiltered: vi.fn(),
      getUncategorizedEvents: vi.fn(),
      batchUpdateCategories: vi.fn(),
    };
    mockEndpointsService = {
      list: vi.fn(),
      getById: vi.fn(),
    };
    mockConfig = { get: vi.fn().mockReturnValue('sk-test-key') };
    mockQueue = { add: vi.fn() };

    // Reset AI SDK mock
    vi.mocked(generateText).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProcessorService,
        AiSummariesConsumer,
        { provide: AiSummariesService, useValue: mockAiSummariesService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: EndpointsService, useValue: mockEndpointsService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken('ai-summaries'), useValue: mockQueue },
      ],
    }).compile();

    consumer = module.get<AiSummariesConsumer>(AiSummariesConsumer);
  });

  it('processes a full AI flow: list endpoints → query events → generate summary → classify → persist', async () => {
    // 1. Endpoints service returns active endpoints
    mockEndpointsService.list.mockResolvedValue([
      { id: 'ep-1', name: 'Payment Webhook', status: 'active' },
    ]);

    // 2. Events service returns events for the endpoint
    mockEventsService.listFiltered.mockResolvedValue({
      items: [
        {
          id: 'evt-1',
          status: 'delivered',
          category: null,
          payload: { type: 'charge', amount: 50 },
          headers: null,
          sourceIp: null,
          traceId: null,
          endpointId: 'ep-1',
          receivedAt: '2026-01-15T12:00:00Z',
          deliveredAt: null,
        },
        {
          id: 'evt-2',
          status: 'failed',
          category: null,
          payload: { type: 'charge', amount: 200 },
          headers: null,
          sourceIp: null,
          traceId: null,
          endpointId: 'ep-1',
          receivedAt: '2026-01-15T12:05:00Z',
          deliveredAt: null,
        },
      ],
      total: 2,
      page: 1,
      limit: 100,
    });

    // 3. AI SDK returns valid summary JSON
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({
        summaryText: 'Processed 2 payment events with 1 failure.',
        eventCount: 2,
        failureCount: 1,
        topCategories: { 'payment.charge': 2 },
      }),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
      warnings: [],
      response: { id: 'resp-1', timestamp: new Date(), modelId: 'gpt-4o-mini' },
      steps: [],
      experimental_output: undefined,
    } as never);

    // 4. Events service returns uncategorized events
    mockEventsService.getUncategorizedEvents.mockResolvedValue([
      {
        id: 'evt-1',
        status: 'delivered',
        category: null,
        payload: {},
        receivedAt: '2026-01-15T12:00:00Z',
        headers: null,
        sourceIp: null,
        traceId: null,
        endpointId: 'ep-1',
        deliveredAt: null,
      },
      {
        id: 'evt-2',
        status: 'failed',
        category: null,
        payload: {},
        receivedAt: '2026-01-15T12:05:00Z',
        headers: null,
        sourceIp: null,
        traceId: null,
        endpointId: 'ep-1',
        deliveredAt: null,
      },
    ]);

    // 5. AI SDK returns classification JSON
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify([
        { eventId: 'evt-1', category: 'payment.charge.success' },
        { eventId: 'evt-2', category: 'payment.charge.failure' },
      ]),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 80, completionTokens: 20, totalTokens: 100 },
      warnings: [],
      response: { id: 'resp-2', timestamp: new Date(), modelId: 'gpt-4o-mini' },
      steps: [],
      experimental_output: undefined,
    } as never);

    // Execute the scheduled job
    await consumer.handleGenerateSummary({
      data: { jobType: 'scheduled' },
    } as Job<AiSummaryJobData>);

    // Verify full flow
    expect(mockEndpointsService.list).toHaveBeenCalled();
    expect(mockEventsService.listFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ endpointId: 'ep-1', limit: 100 }),
    );

    // Summary was upserted
    expect(mockAiSummariesService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointId: 'ep-1',
        summaryText: 'Processed 2 payment events with 1 failure.',
        eventCount: 2,
        failureCount: 1,
      }),
    );

    // AI SDK was called twice (summary + classification)
    expect(generateText).toHaveBeenCalledTimes(2);

    // Uncategorized events were classified
    expect(mockEventsService.getUncategorizedEvents).toHaveBeenCalled();
    expect(mockEventsService.batchUpdateCategories).toHaveBeenCalled();
  });

  it('completes successfully when AI provider is unreachable', async () => {
    mockEndpointsService.list.mockResolvedValue([{ id: 'ep-1', name: 'Test', status: 'active' }]);
    mockEventsService.listFiltered.mockResolvedValue({
      items: [
        {
          id: 'evt-1',
          status: 'delivered',
          category: null,
          payload: {},
          headers: null,
          sourceIp: null,
          traceId: null,
          endpointId: 'ep-1',
          receivedAt: '2026-01-15T12:00:00Z',
          deliveredAt: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    });

    // AI provider throws network error
    vi.mocked(generateText).mockRejectedValue(new Error('Network error'));

    await consumer.handleGenerateSummary({
      data: { jobType: 'scheduled' },
    } as Job<AiSummaryJobData>);

    // Job completes without throwing
    expect(mockEndpointsService.list).toHaveBeenCalled();
    expect(mockAiSummariesService.upsert).not.toHaveBeenCalled();
  });

  it('completes successfully when no endpoints exist', async () => {
    mockEndpointsService.list.mockResolvedValue([]);

    await consumer.handleGenerateSummary({
      data: { jobType: 'scheduled' },
    } as Job<AiSummaryJobData>);

    expect(mockEndpointsService.list).toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });
});
