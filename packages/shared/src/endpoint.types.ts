export type HookMateEndpointStatus = 'active' | 'paused' | 'deleted';

export interface HookMateEndpoint {
  id: string;
  name: string;
  destinationUrl: string;
  status: HookMateEndpointStatus;
  maxRetries: number;
  retryBaseDelayMs: number;
  dlqThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHookMateEndpointInput {
  name: string;
  destinationUrl: string;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  dlqThreshold?: number;
}
