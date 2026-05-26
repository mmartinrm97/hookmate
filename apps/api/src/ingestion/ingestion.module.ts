import { Module } from '@nestjs/common';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { EventsModule } from '../events/events.module';
import { SqsModule } from '../sqs/sqs.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [EndpointsModule, EventsModule, SqsModule],
  providers: [IngestionService, IngestionController],
  exports: [IngestionService],
})
export class IngestionModule {}
