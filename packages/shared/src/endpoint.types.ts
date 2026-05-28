export type HookMateEndpointStatus = 'active' | 'paused' | 'deleted';

export interface HookMateEndpoint {
  id: string;
  name: string;
  destinationUrl: string;
  secret?: string;
  status: HookMateEndpointStatus;
  maxRetries: number;
  retryBaseDelayMs: number;
  dlqThreshold: number;
  cbFailureThreshold?: number;
  cbWindowSeconds?: number;
  cbCooldownSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHookMateEndpointInput {
  name: string;
  destinationUrl: string;
  secret?: string;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  dlqThreshold?: number;
  cbFailureThreshold?: number;
  cbWindowSeconds?: number;
  cbCooldownSeconds?: number;
}

export interface UpdateHookMateEndpointInput {
  name?: string;
  destinationUrl?: string;
  secret?: string;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  dlqThreshold?: number;
  cbFailureThreshold?: number;
  cbWindowSeconds?: number;
  cbCooldownSeconds?: number;
}
