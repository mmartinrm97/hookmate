import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';
import { DeliveryAttemptsModule } from '../delivery-attempts/delivery-attempts.module';
import { DlqEventsModule } from '../dlq-events/dlq-events.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { EventsModule } from '../events/events.module';
import { RoutingRulesModule } from '../routing-rules/routing-rules.module';
import { DeliveryService } from './delivery.service';
import { DlqPromoterService } from './dlq-promoter.service';
import { ProcessorService } from './processor.service';
import { RetryConsumer } from './retry.consumer';
import { RoutingEvaluatorService } from './routing-evaluator.service';
import { SqsConsumerService } from './sqs-consumer.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'retries',
    }),
    BullModule.registerQueue({
      name: 'ai-summaries',
    }),
    EventsModule,
    EndpointsModule,
    DeliveryAttemptsModule,
    DlqEventsModule,
    RoutingRulesModule,
    CircuitBreakerModule,
  ],
  providers: [
    ProcessorService,
    DeliveryService,
    RoutingEvaluatorService,
    DlqPromoterService,
    SqsConsumerService,
    RetryConsumer,
  ],
  exports: [ProcessorService],
})
export class ProcessorModule {}
