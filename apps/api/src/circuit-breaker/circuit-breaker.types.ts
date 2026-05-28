export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitCheckResult {
  state: CircuitState;
  canProceed: boolean;
}

export interface CircuitStatus {
  state: CircuitState;
  failureRate: number | null;
  windowSeconds: number;
  cooldownRemainingSeconds: number | null;
}

export interface CbOptions {
  failureThreshold: number;
  windowSeconds: number;
  cooldownSeconds: number;
}

export const CIRCUIT_BREAKER = Symbol('ICircuitBreaker');
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export interface ICircuitBreaker {
  checkState(endpointId: string): Promise<CircuitCheckResult>;
  recordSuccess(endpointId: string): Promise<void>;
  recordFailure(endpointId: string, options?: CbOptions): Promise<void>;
  reset(endpointId: string): Promise<void>;
  getStatus(endpointId: string): Promise<CircuitStatus>;
}
