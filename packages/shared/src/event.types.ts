export type HookMateEventStatus =
  | 'received'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'dead_lettered';

export interface HookMateEvent {
  id: string;
  endpointId: string;
  payload: Record<string, unknown>;
  headers: Record<string, string> | null;
  sourceIp: string | null;
  status: HookMateEventStatus;
  category: string | null;
  traceId: string | null;
  receivedAt: string;
  deliveredAt: string | null;
}
