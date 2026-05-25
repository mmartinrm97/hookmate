import { Test, type TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bull';
import { AiProcessorService } from './ai-processor.service';
import { AiSummariesConsumer } from './ai-summaries.consumer';
import { AiSummariesService } from './ai-summaries.service';
import { EventsService } from '../events/events.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import type { AiSummaryJobData } from './ai-summaries.types';

function makeEvent(id: string, category: string | null) {
  return {
    id,
    status: 'delivered' as const,
    category,
    payload: { amount: 100 },
    receivedAt: '2026-01-15T12:00:00Z',
    headers: null,
    sourceIp: null,
    traceId: null,
    endpointId: 'ep-1',
    deliveredAt: null,
  };
}

describe('AiSummariesConsumer', () => {
  let consumer: AiSummariesConsumer;
  let mockAiProcessor: {
    generateSummary: ReturnType<typeof vi.fn>;
    classifyEvents: ReturnType<typeof vi.fn>;
  };
  let mockAiSummariesService: { upsert: ReturnType<typeof vi.fn> };
  let mockEventsService: {
    listFiltered: ReturnType<typeof vi.fn>;
    getUncategorizedEvents: ReturnType<typeof vi.fn>;
    batchUpdateCategories: ReturnType<typeof vi.fn>;
  };
  let mockEndpointsService: { list: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn> };
  let mockQueue: { add: ReturnType<typeof vi.fn> };
  let mockJob: { data: AiSummaryJobData };

  beforeEach(async () => {
    mockAiProcessor = {
      generateSummary: vi.fn(),
      classifyEvents: vi.fn(),
    };
    mockAiSummariesService = {
      upsert: vi.fn(),
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
    mockQueue = { add: vi.fn() };
    mockJob = { data: { jobType: 'scheduled' } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSummariesConsumer,
        { provide: AiProcessorService, useValue: mockAiProcessor },
        { provide: AiSummariesService, useValue: mockAiSummariesService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: EndpointsService, useValue: mockEndpointsService },
        { provide: getQueueToken('ai-summaries'), useValue: mockQueue },
      ],
    }).compile();

    consumer = module.get<AiSummariesConsumer>(AiSummariesConsumer);
  });

  describe('handleGenerateSummary', () => {
    it('processes endpoints with events and calls AI for summary and classification', async () => {
      mockEndpointsService.list.mockResolvedValue([
        { id: 'ep-1', name: 'Endpoint 1', status: 'active' },
        { id: 'ep-2', name: 'Endpoint 2', status: 'active' },
      ]);
      mockEventsService.listFiltered.mockResolvedValue({
        items: [makeEvent('evt-1', null)],
        total: 1,
        page: 1,
        limit: 100,
      });
      mockEventsService.getUncategorizedEvents
        .mockResolvedValueOnce([makeEvent('evt-1', null)]) // ep-1: events to classify
        .mockResolvedValueOnce([]); // ep-2: none to classify
      mockAiProcessor.generateSummary.mockResolvedValue({
        summaryText: 'Summary for endpoint',
        eventCount: 1,
        failureCount: 0,
        topCategories: {},
      });
      mockAiProcessor.classifyEvents.mockResolvedValue([
        { eventId: 'evt-1', category: 'payment.charge' },
      ]);

      await consumer.handleGenerateSummary(mockJob as Job<AiSummaryJobData>);

      expect(mockEndpointsService.list).toHaveBeenCalled();
      expect(mockAiProcessor.generateSummary).toHaveBeenCalledTimes(2);
      expect(mockAiProcessor.generateSummary).toHaveBeenCalledWith(
        { id: 'ep-1', name: 'Endpoint 1' },
        expect.any(Array),
      );
      expect(mockAiProcessor.generateSummary).toHaveBeenCalledWith(
        { id: 'ep-2', name: 'Endpoint 2' },
        expect.any(Array),
      );
      expect(mockAiSummariesService.upsert).toHaveBeenCalledTimes(2);
      expect(mockAiProcessor.classifyEvents).toHaveBeenCalledTimes(1);
      expect(mockAiProcessor.classifyEvents).toHaveBeenCalledWith([
        { eventId: 'evt-1', payload: { amount: 100 }, receivedAt: '2026-01-15T12:00:00Z' },
      ]);
      expect(mockEventsService.batchUpdateCategories).toHaveBeenCalledTimes(1);
    });

    it('skips endpoints with no events in the last 24h', async () => {
      mockEndpointsService.list.mockResolvedValue([
        { id: 'ep-1', name: 'Endpoint 1', status: 'active' },
      ]);
      mockEventsService.listFiltered.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 100,
      });

      await consumer.handleGenerateSummary(mockJob as Job<AiSummaryJobData>);

      expect(mockEndpointsService.list).toHaveBeenCalled();
      expect(mockAiProcessor.generateSummary).not.toHaveBeenCalled();
      expect(mockAiSummariesService.upsert).not.toHaveBeenCalled();
    });

    it('isolates AI failures per endpoint and continues to the next', async () => {
      mockEndpointsService.list.mockResolvedValue([
        { id: 'ep-1', name: 'Endpoint 1', status: 'active' },
        { id: 'ep-2', name: 'Endpoint 2', status: 'active' },
      ]);
      mockEventsService.listFiltered.mockResolvedValue({
        items: [makeEvent('evt-1', null)],
        total: 1,
        page: 1,
        limit: 100,
      });

      // First endpoint throws, second works
      mockAiProcessor.generateSummary
        .mockRejectedValueOnce(new Error('API failure'))
        .mockResolvedValueOnce({
          summaryText: 'Second endpoint summary',
          eventCount: 1,
          failureCount: 0,
          topCategories: {},
        });
      mockEventsService.getUncategorizedEvents.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await consumer.handleGenerateSummary(mockJob as Job<AiSummaryJobData>);

      expect(mockAiProcessor.generateSummary).toHaveBeenCalledTimes(2);
      // Only the second should have upserted
      expect(mockAiSummariesService.upsert).toHaveBeenCalledTimes(1);
    });

    it('handles on-demand job for a specific endpoint', async () => {
      mockJob.data = { jobType: 'on-demand', endpointId: 'ep-1' };
      mockEndpointsService.getById.mockResolvedValue({
        id: 'ep-1',
        name: 'Endpoint 1',
        status: 'active',
      });
      mockEventsService.listFiltered.mockResolvedValue({
        items: [makeEvent('evt-1', null)],
        total: 1,
        page: 1,
        limit: 100,
      });
      mockAiProcessor.generateSummary.mockResolvedValue({
        summaryText: 'On-demand summary',
        eventCount: 1,
        failureCount: 0,
        topCategories: {},
      });
      mockEventsService.getUncategorizedEvents.mockResolvedValue([]);

      await consumer.handleGenerateSummary(mockJob as Job<AiSummaryJobData>);

      expect(mockAiProcessor.generateSummary).toHaveBeenCalledTimes(1);
      expect(mockAiProcessor.generateSummary).toHaveBeenCalledWith(
        { id: 'ep-1', name: 'Endpoint 1' },
        expect.any(Array),
      );
      expect(mockAiSummariesService.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
