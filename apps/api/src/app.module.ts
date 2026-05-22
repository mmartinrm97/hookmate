import { Module } from '@nestjs/common';
import { AiSummariesModule } from './ai-summaries/ai-summaries.module';
import { CoreModule } from './core/core.module';
import { DeliveryAttemptsModule } from './delivery-attempts/delivery-attempts.module';
import { DlqEventsModule } from './dlq-events/dlq-events.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ProcessorModule } from './processor/processor.module';
import { RoutingRulesModule } from './routing-rules/routing-rules.module';
import { SqsModule } from './sqs/sqs.module';

@Module({
  imports: [
    CoreModule,
    HealthModule,
    EndpointsModule,
    EventsModule,
    DeliveryAttemptsModule,
    DlqEventsModule,
    RoutingRulesModule,
    AiSummariesModule,
    SqsModule,
    IngestionModule,
    ProcessorModule,
  ],
})
export class AppModule {}
