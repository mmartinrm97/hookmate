import { Process, Processor } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import type { HookMateEndpoint } from '@hookmate/shared';
import { EndpointsService } from '../endpoints/endpoints.service';
import { EventsService } from '../events/events.service';
import { AiProcessorService } from './ai-processor.service';
import { AiSummariesService } from './ai-summaries.service';
import type { AiSummaryJobData } from './ai-summaries.types';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable()
@Processor('ai-summaries')
export class AiSummariesConsumer {
  private readonly logger = new Logger(AiSummariesConsumer.name);

  constructor(
    @Inject(EndpointsService) private readonly endpointsService: EndpointsService,
    @Inject(AiProcessorService) private readonly aiProcessor: AiProcessorService,
    @Inject(AiSummariesService) private readonly aiSummariesService: AiSummariesService,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  /**
   * Handles the 'generate-summary' job. Iterates endpoints with recent events,
   * generates summaries, classifies uncategorized events, and persists results.
   * All errors are caught and logged — the job never fails externally.
   */
  @Process('generate-summary')
  async handleGenerateSummary(job: Job<AiSummaryJobData>): Promise<void> {
    const { jobType, endpointId } = job.data;

    try {
      const endpoints = await this.resolveEndpoints(endpointId);
      const now = new Date();
      const from = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
      const fromStr = from.toISOString();
      const toStr = now.toISOString();

      for (const endpoint of endpoints) {
        await this.processEndpoint(endpoint, fromStr, toStr);
      }
    } catch (error) {
      this.logger.error(
        `Failed to list endpoints for ${jobType} job: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async resolveEndpoints(
    singleEndpointId?: string,
  ): Promise<Pick<HookMateEndpoint, 'id' | 'name'>[]> {
    if (singleEndpointId) {
      const endpoint = await this.endpointsService.getById(singleEndpointId);
      return [{ id: endpoint.id, name: endpoint.name }];
    }

    const all = await this.endpointsService.list();
    return all.filter((e) => e.status === 'active').map((e) => ({ id: e.id, name: e.name }));
  }

  private async processEndpoint(
    endpoint: Pick<HookMateEndpoint, 'id' | 'name'>,
    from: string,
    to: string,
  ): Promise<void> {
    try {
      const eventsResult = await this.eventsService.listFiltered({
        endpointId: endpoint.id,
        from,
        to,
        limit: 100,
      });

      if (eventsResult.items.length === 0) {
        this.logger.log(`No events for endpoint ${endpoint.id}, skipping`);
        return;
      }

      // Generate summary
      const summary = await this.aiProcessor.generateSummary(endpoint, eventsResult.items);

      if (!summary) {
        this.logger.warn(`Summary generation returned null for endpoint ${endpoint.id}`);
        return;
      }

      // Persist summary
      await this.aiSummariesService.upsert({
        endpointId: endpoint.id,
        periodStart: from,
        periodEnd: to,
        summaryText: summary.summaryText,
        eventCount: summary.eventCount,
        failureCount: summary.failureCount,
        topCategories: summary.topCategories,
        model: 'gpt-4o-mini',
      });

      // Classify uncategorized events
      await this.classifyAndUpdate(endpoint.id, from, to);
    } catch (error) {
      this.logger.error(
        `AI processing failed for endpoint ${endpoint.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async classifyAndUpdate(endpointId: string, from: string, to: string): Promise<void> {
    try {
      const uncategorized = await this.eventsService.getUncategorizedEvents(endpointId, from, to);

      if (uncategorized.length === 0) {
        return;
      }

      const input = uncategorized.map((e) => ({
        eventId: e.id,
        payload: e.payload,
        receivedAt: e.receivedAt,
      }));

      const classifications = await this.aiProcessor.classifyEvents(input);

      if (!classifications || classifications.length === 0) {
        return;
      }

      const updates = new Map<string, string>();
      for (const item of classifications) {
        updates.set(item.eventId, item.category);
      }

      await this.eventsService.batchUpdateCategories(updates);
    } catch (error) {
      this.logger.error(
        `Classification failed for endpoint ${endpointId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
