import type { HookMateDeliveryAttempt, HookMateEndpoint, HookMateEvent } from '@hookmate/shared';
import { Injectable, Logger } from '@nestjs/common';
import { DlqEventsService } from '../dlq-events/dlq-events.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class DlqPromoterService {
  private readonly logger = new Logger(DlqPromoterService.name);

  constructor(
    private readonly dlqEventsService: DlqEventsService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Promotes an event to the DLQ after max retries are exhausted.
   * Snapshot delivery attempts and endpoint config, then update event status to dead_lettered.
   */
  async promote(
    event: HookMateEvent,
    endpoint: HookMateEndpoint,
    attempts: HookMateDeliveryAttempt[],
    failureReason: string,
  ): Promise<void> {
    const endpointSnapshot = {
      id: endpoint.id,
      name: endpoint.name,
      destinationUrl: endpoint.destinationUrl,
    };

    try {
      await this.dlqEventsService.create({
        eventId: event.id,
        endpointId: endpoint.id,
        failureReason,
        attemptsJson: attempts,
        endpointSnapshot,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create DLQ event for ${event.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }

    try {
      await this.eventsService.updateStatus(event.id, 'dead_lettered');
    } catch (error) {
      this.logger.error(
        `Failed to update event ${event.id} status to dead_lettered: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
