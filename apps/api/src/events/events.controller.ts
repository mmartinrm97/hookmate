import type { HookMateDeliveryAttempt, HookMateEvent, PaginatedResponse } from '@hookmate/shared';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeliveryAttemptsService } from '../delivery-attempts/delivery-attempts.service';
import { ListEventsDto } from './dto/list-events.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(DeliveryAttemptsService)
    private readonly deliveryAttemptsService: DeliveryAttemptsService,
  ) {}

  @ApiOperation({ summary: 'List events with filtering and pagination' })
  @ApiOkResponse({ description: 'Paginated events list.' })
  @Get()
  async list(@Query() query: ListEventsDto): Promise<PaginatedResponse<HookMateEvent>> {
    return this.eventsService.listFiltered(query);
  }

  @ApiOperation({ summary: 'Get a single event by id' })
  @ApiOkResponse({ description: 'Event detail.' })
  @Get(':id')
  async getById(@Param('id') id: string): Promise<HookMateEvent> {
    return this.eventsService.getById(id);
  }

  @ApiOperation({ summary: 'Get delivery attempts for an event' })
  @ApiOkResponse({ description: 'Delivery attempts list.' })
  @Get(':id/attempts')
  async getAttempts(@Param('id') id: string): Promise<HookMateDeliveryAttempt[]> {
    return this.deliveryAttemptsService.getByEventId(id);
  }
}
