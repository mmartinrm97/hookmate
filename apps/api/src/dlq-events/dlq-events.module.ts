import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DlqEventsService } from './dlq-events.service';
import { DlqEvent } from './entities/dlq-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DlqEvent])],
  providers: [DlqEventsService],
  exports: [DlqEventsService],
})
export class DlqEventsModule {}
