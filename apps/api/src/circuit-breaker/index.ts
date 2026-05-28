export type {
  CircuitState,
  CircuitCheckResult,
  CircuitStatus,
  CbOptions,
  ICircuitBreaker,
} from './circuit-breaker.types';
export { CIRCUIT_BREAKER, REDIS_CLIENT } from './circuit-breaker.types';
export { RedisCircuitBreakerService } from './redis-circuit-breaker.service';
export { CircuitBreakerModule } from './circuit-breaker.module';
