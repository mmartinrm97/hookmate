import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryAttemptsModule } from '../delivery-attempts/delivery-attempts.module';
import { DlqEventsModule } from '../dlq-events/dlq-events.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { EventsModule } from '../events/events.module';
import { DeliveryAttempt } from '../delivery-attempts/entities/delivery-attempt.entity';
import { DlqEvent } from '../dlq-events/entities/dlq-event.entity';
import { Event } from '../events/entities/event.entity';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, DlqEvent, DeliveryAttempt]),
    EndpointsModule,
    EventsModule,
    DlqEventsModule,
    DeliveryAttemptsModule,
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
