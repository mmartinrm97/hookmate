import type {
  HookMateEndpoint,
  HookMateEvent,
  HookMateDlqEvent,
  HookMateAiSummary,
  HookMateDeliveryAttempt,
  PaginatedResponse,
} from '@hookmate/shared';
import type {
  EndpointWithStats,
  CreateEndpointFormData,
  UpdateEndpointFormData,
  EventsFilterState,
  EventSortState,
  MetricsSnapshot,
  TimeSeriesPoint,
  EndpointMetrics,
} from '../types/api.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Typed fetch wrapper ─────────────────────────────────────────

class ApiRequestError extends Error {
  statusCode: number;
  error: string;

  constructor(statusCode: number, message: string, error: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = import.meta.env.VITE_API_TOKEN;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: { message?: string; error?: string } = {};
    try {
      body = await response.json();
    } catch {
      // ignore parse failure
    }
    throw new ApiRequestError(
      response.status,
      body.message || `Request failed with status ${response.status}`,
      body.error || 'Unknown error',
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Build query string ──────────────────────────────────────────

function toQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

// ─── Endpoints API ───────────────────────────────────────────────

export const endpointsApi = {
  list: () => apiFetch<EndpointWithStats[]>('/api/v1/endpoints'),

  get: (id: string) => apiFetch<HookMateEndpoint>(`/api/v1/endpoints/${id}`),

  create: (data: CreateEndpointFormData) =>
    apiFetch<HookMateEndpoint>('/api/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateEndpointFormData) =>
    apiFetch<HookMateEndpoint>(`/api/v1/endpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiFetch<void>(`/api/v1/endpoints/${id}`, { method: 'DELETE' }),

  toggleStatus: (id: string, status: 'active' | 'paused') =>
    apiFetch<HookMateEndpoint>(`/api/v1/endpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// ─── Events API ──────────────────────────────────────────────────

export const eventsApi = {
  list: (filters: EventsFilterState, sort?: EventSortState) => {
    const params: Record<string, string | number | undefined> = {
      page: filters.page,
      limit: filters.limit,
      endpointId: filters.endpointId,
      status: filters.status || undefined,
      category: filters.category || undefined,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      sortBy: sort?.column,
      sortDirection: sort?.direction,
    };
    return apiFetch<PaginatedResponse<HookMateEvent>>(`/api/v1/events${toQueryString(params)}`);
  },

  get: (id: string) =>
    apiFetch<HookMateEvent & { deliveryAttempts?: HookMateDeliveryAttempt[] }>(
      `/api/v1/events/${id}`,
    ),
};

// ─── DLQ API ─────────────────────────────────────────────────────

export const dlqApi = {
  list: (page = 1, limit = 25) =>
    apiFetch<PaginatedResponse<HookMateDlqEvent>>(`/api/v1/dlq?page=${page}&limit=${limit}`),

  retry: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/v1/dlq/${id}/retry`, {
      method: 'POST',
    }),

  retryAll: () =>
    apiFetch<{ retried: number }>('/api/v1/dlq/retry-all', {
      method: 'POST',
    }),

  purge: () =>
    apiFetch<{ purged: number }>('/api/v1/dlq', {
      method: 'DELETE',
    }),
};

// ─── AI Summaries API ────────────────────────────────────────────

export const summariesApi = {
  list: () => apiFetch<HookMateAiSummary[]>('/api/v1/summaries'),

  getByEndpoint: (endpointId: string) =>
    apiFetch<HookMateAiSummary[]>(`/api/v1/endpoints/${endpointId}/summaries`),

  generate: (endpointId: string) =>
    apiFetch<HookMateAiSummary>(`/api/v1/endpoints/${endpointId}/summaries/generate`, {
      method: 'POST',
    }),
};

// ─── Metrics API ─────────────────────────────────────────────────

export const metricsApi = {
  getSnapshot: () => apiFetch<MetricsSnapshot>('/api/v1/metrics/snapshot'),

  getQueueDepth: (hours = 24) =>
    apiFetch<TimeSeriesPoint[]>(`/api/v1/metrics/queue-depth?hours=${hours}`),

  getEventsByStatus: () =>
    apiFetch<{ status: string; count: number }[]>('/api/v1/metrics/events-by-status'),

  getLatency: (hours = 24) =>
    apiFetch<{ p50: number; p90: number; p99: number; timestamp: string }[]>(
      `/api/v1/metrics/latency?hours=${hours}`,
    ),

  getErrorRate: (hours = 24) =>
    apiFetch<TimeSeriesPoint[]>(`/api/v1/metrics/error-rate?hours=${hours}`),

  getEndpointMetrics: () => apiFetch<EndpointMetrics[]>('/api/v1/metrics/endpoints'),
};

export { ApiRequestError };
