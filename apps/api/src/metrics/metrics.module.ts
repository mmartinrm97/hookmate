import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';
import { DeliveryAttemptsModule } from '../delivery-attempts/delivery-attempts.module';
import { DlqEventsModule } from '../dlq-events/dlq-events.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { EventsModule } from '../events/events.module';
import { DeliveryAttempt } from '../delivery-attempts/entities/delivery-attempt.entity';
import { DlqEvent } from '../dlq-events/entities/dlq-event.entity';
import { Event } from '../events/entities/event.entity';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsSseHandler } from './sse/metrics-sse.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, DlqEvent, DeliveryAttempt]),
    CircuitBreakerModule,
    EndpointsModule,
    EventsModule,
    DlqEventsModule,
    DeliveryAttemptsModule,
  ],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsSseHandler],
  exports: [MetricsService],
})
export class MetricsModule {}
