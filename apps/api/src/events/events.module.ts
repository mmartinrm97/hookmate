import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
