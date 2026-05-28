export type HookMateDeliveryAttemptStatus = 'success' | 'failed' | 'timeout' | 'circuit_open';

export interface HookMateDeliveryAttempt {
  id: number;
  eventId: string;
  attemptNumber: number;
  destinationUrl: string;
  httpStatus: number | null;
  responseBody: string | null;
  latencyMs: number | null;
  status: HookMateDeliveryAttemptStatus;
  attemptedAt: string;
}
