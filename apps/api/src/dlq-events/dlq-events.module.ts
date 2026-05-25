import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DlqEventsController } from './dlq-events.controller';
import { DlqEventsService } from './dlq-events.service';
import { DlqEvent } from './entities/dlq-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DlqEvent]), BullModule.registerQueue({ name: 'retries' })],
  controllers: [DlqEventsController],
  providers: [DlqEventsService],
  exports: [DlqEventsService],
})
export class DlqEventsModule {}
