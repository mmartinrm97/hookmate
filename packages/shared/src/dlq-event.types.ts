export interface HookMateDlqEvent {
  id: string;
  eventId: string;
  endpointId: string;
  failureReason: string | null;
  attemptsJson: unknown[];
  endpointSnapshot: Record<string, unknown>;
  createdAt: string;
  retriedAt: string | null;
}
