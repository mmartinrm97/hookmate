import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CIRCUIT_BREAKER, REDIS_CLIENT } from './circuit-breaker.types';
import { RedisCircuitBreakerService } from './redis-circuit-breaker.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        return new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 50, 2000),
          lazyConnect: true,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: CIRCUIT_BREAKER,
      useClass: RedisCircuitBreakerService,
    },
  ],
  exports: [CIRCUIT_BREAKER],
})
export class CircuitBreakerModule {}
