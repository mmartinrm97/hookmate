import { Module } from '@nestjs/common';
import { AiSummariesModule } from './ai-summaries/ai-summaries.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';
import { DeliveryAttemptsModule } from './delivery-attempts/delivery-attempts.module';
import { DlqEventsModule } from './dlq-events/dlq-events.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { MetricsModule } from './metrics/metrics.module';
import { ProcessorModule } from './processor/processor.module';
import { RoutingRulesModule } from './routing-rules/routing-rules.module';
import { SqsModule } from './sqs/sqs.module';

@Module({
  imports: [
    AiSummariesModule,
    AuthModule,
    CoreModule,
    DeliveryAttemptsModule,
    DlqEventsModule,
    EndpointsModule,
    EventsModule,
    HealthModule,
    IngestionModule,
    MetricsModule,
    ProcessorModule,
    RoutingRulesModule,
    SqsModule,
  ],
})
export class AppModule {}
