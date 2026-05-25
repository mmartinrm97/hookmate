import type {
  HookMateEndpoint,
  HookMateEvent,
  HookMateEventStatus,
  HookMateDlqEvent,
  HookMateAiSummary,
  HookMateDeliveryAttempt,
  PaginatedResponse,
} from '@hookmate/shared';

// ─── Endpoint with stats ─────────────────────────────────────────

export interface EndpointWithStats extends HookMateEndpoint {
  eventCount?: number;
  lastActivityAt?: string;
}

export interface CreateEndpointFormData {
  name: string;
  destinationUrl: string;
  secret?: string;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  dlqThreshold?: number;
}

export interface UpdateEndpointFormData {
  name?: string;
  destinationUrl?: string;
  status?: 'active' | 'paused';
}

// ─── Events ──────────────────────────────────────────────────────

export interface EventsFilterState {
  endpointId?: string;
  status?: HookMateEventStatus | '';
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export type SortDirection = 'asc' | 'desc';

export interface EventSortState {
  column: string;
  direction: SortDirection;
}

export type EventsResponse = PaginatedResponse<HookMateEvent>;

export interface EventWithAttempts extends HookMateEvent {
  deliveryAttempts?: HookMateDeliveryAttempt[];
}

// ─── DLQ ─────────────────────────────────────────────────────────

export interface DlqEventWithMeta extends HookMateDlqEvent {
  endpointName?: string;
}

export type DlqResponse = PaginatedResponse<HookMateDlqEvent>;

// ─── Summaries ───────────────────────────────────────────────────

export interface SummaryWithEndpoint extends HookMateAiSummary {
  endpointName?: string;
}

// ─── Metrics ─────────────────────────────────────────────────────

export interface MetricsSnapshot {
  queueDepth: number;
  errorRate: number;
  latencyMs: {
    p50: number;
    p90: number;
    p99: number;
  };
  throughput: number;
  timestamp: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface EndpointMetrics {
  endpointId: string;
  endpointName: string;
  eventCount: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
}

// ─── API error ───────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}
