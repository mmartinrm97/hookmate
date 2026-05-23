import type { HookMateDeliveryAttemptStatus } from '@hookmate/shared';

export interface ProcessInput {
  event_id: string;
  endpoint_id: string;
  attempt_number: number;
}

export interface DeliveryResult {
  status: HookMateDeliveryAttemptStatus;
  httpStatus: number | null;
  latencyMs: number;
  responseBody: string | null;
}

export interface RetryJobData {
  event_id: string;
  endpoint_id: string;
  attempt_number: number;
}

export interface DlqCreateInput {
  event_id: string;
  endpoint_id: string;
  failure_reason: string;
  attempts_json: unknown[];
  endpoint_snapshot: Record<string, unknown>;
}

export type ProcessResultType = 'delivered' | 'failed_retry' | 'dead_lettered' | 'skipped';

export interface ProcessResult {
  status: ProcessResultType;
  eventId: string;
  endpointId: string;
  attemptNumber: number;
  destinationUrl?: string;
}
