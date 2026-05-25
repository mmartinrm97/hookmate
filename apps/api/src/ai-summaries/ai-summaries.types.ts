/**
 * Job data for the ai-summaries BullMQ queue.
 */
export interface AiSummaryJobData {
  jobType: 'scheduled' | 'on-demand';
  endpointId?: string;
}

/**
 * Input passed to the AI provider for summary generation.
 */
export interface SummaryPromptInput {
  endpointName: string;
  events: Array<{
    id: string;
    status: string;
    category: string | null;
    payload: Record<string, unknown>;
    receivedAt: string;
  }>;
}

/**
 * Parsed JSON response from the AI summary prompt.
 */
export interface SummaryResponse {
  summaryText: string;
  eventCount: number;
  failureCount: number;
  topCategories: Record<string, number>;
}

/**
 * A single classification item from the AI classification response.
 */
export interface ClassificationResponseItem {
  eventId: string;
  category: string;
}
