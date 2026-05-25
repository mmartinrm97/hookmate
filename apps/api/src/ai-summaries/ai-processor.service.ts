import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { HookMateEndpoint } from '@hookmate/shared';
import type {
  ClassificationResponseItem,
  SummaryPromptInput,
  SummaryResponse,
} from './ai-summaries.types';

const SUMMARY_SYSTEM_PROMPT =
  'You analyze webhook events. Return ONLY valid JSON: `{ summaryText, eventCount, failureCount, topCategories }`. ' +
  '`summaryText` is a 2-4 sentence natural-language summary of the batch. ' +
  '`topCategories` uses `domain.action` keys with integer counts.';

const CLASSIFICATION_SYSTEM_PROMPT =
  'Classify each webhook event into a `domain.action` category. ' +
  'Return ONLY a JSON array: `[{ eventId, category }]`. ' +
  'Inspect the payload to determine the category.';

interface ClassificationInput {
  eventId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

@Injectable()
export class AiProcessorService {
  private readonly logger = new Logger(AiProcessorService.name);
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.model = this.configService.get<string>('AI_MODEL') ?? 'gpt-4o-mini';
  }

  /**
   * Generate an AI summary for a batch of events belonging to an endpoint.
   * Returns null when the API key is missing, the events array is empty,
   * the AI provider errors, or the response cannot be parsed.
   */
  async generateSummary(
    endpoint: Pick<HookMateEndpoint, 'name' | 'id'>,
    events: SummaryPromptInput['events'],
  ): Promise<SummaryResponse | null> {
    if (!this.isAiEnabled()) {
      this.logger.warn('AI disabled — missing OPENAI_API_KEY');
      return null;
    }

    if (events.length === 0) {
      return null;
    }

    const userPrompt = JSON.stringify({
      endpointName: endpoint.name,
      totalEvents: events.length,
      events: events.map((e) => ({
        id: e.id,
        status: e.status,
        category: e.category,
        payload: e.payload,
        receivedAt: e.receivedAt,
      })),
    });

    try {
      const { text } = await generateText({
        model: openai(this.model),
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 2000,
      });

      return this.parseSummaryResponse(text);
    } catch (error) {
      this.logger.error(
        `AI summary generation failed for endpoint ${endpoint.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  /**
   * Classify uncategorized events into domain.action categories.
   * Returns null when the API key is missing, the events array is empty,
   * the AI provider errors, or the response cannot be parsed.
   * Filters out items with empty or missing category fields.
   */
  async classifyEvents(
    events: ClassificationInput[],
  ): Promise<ClassificationResponseItem[] | null> {
    if (!this.isAiEnabled()) {
      this.logger.warn('AI disabled — missing OPENAI_API_KEY');
      return null;
    }

    if (events.length === 0) {
      return null;
    }

    try {
      const { text } = await generateText({
        model: openai(this.model),
        system: CLASSIFICATION_SYSTEM_PROMPT,
        prompt: JSON.stringify(events),
        temperature: 0.3,
        maxTokens: 1000,
      });

      return this.parseClassificationResponse(text);
    } catch (error) {
      this.logger.error(
        `AI classification failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  private isAiEnabled(): boolean {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    return Boolean(key && key.length > 0);
  }

  private parseSummaryResponse(text: string): SummaryResponse | null {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;

      if (
        typeof parsed.summaryText !== 'string' ||
        typeof parsed.eventCount !== 'number' ||
        typeof parsed.failureCount !== 'number' ||
        typeof parsed.topCategories !== 'object' ||
        parsed.topCategories === null
      ) {
        this.logger.warn('AI summary response missing required fields');
        return null;
      }

      return {
        summaryText: parsed.summaryText,
        eventCount: parsed.eventCount,
        failureCount: parsed.failureCount,
        topCategories: parsed.topCategories as Record<string, number>,
      };
    } catch {
      this.logger.warn('Failed to parse AI summary response as JSON');
      return null;
    }
  }

  private parseClassificationResponse(text: string): ClassificationResponseItem[] | null {
    try {
      const parsed = JSON.parse(text) as Array<Record<string, unknown>>;

      if (!Array.isArray(parsed)) {
        this.logger.warn('AI classification response is not an array');
        return null;
      }

      return parsed.filter(
        (item): item is ClassificationResponseItem =>
          typeof item.eventId === 'string' &&
          typeof item.category === 'string' &&
          item.category.length > 0,
      );
    } catch {
      this.logger.warn('Failed to parse AI classification response as JSON');
      return null;
    }
  }
}
