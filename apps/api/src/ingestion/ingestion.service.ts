import type { HookMateEvent } from '@hookmate/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { EndpointsService } from '../endpoints/endpoints.service';
import { EventsService } from '../events/events.service';
import { SqsService } from '../sqs/sqs.service';
import { verifySignature } from '../utils/hmac';

export interface IngestInput {
  endpointId: string;
  rawBody: Buffer;
  headers: Record<string, string>;
  sourceIp: string;
  signature?: string;
}

export interface IngestResult {
  event_id: string;
  trace_id: string;
  received_at: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(EndpointsService)
    private readonly endpointsService: EndpointsService,
    @Inject(EventsService)
    private readonly eventsService: EventsService,
    @Inject(SqsService)
    private readonly sqsService: SqsService,
  ) {}

  async ingest(input: IngestInput): Promise<IngestResult> {
    const { endpointId, rawBody, headers, sourceIp, signature } = input;

    // Step 1: Lookup endpoint
    const endpoint = await this.endpointsService.getById(endpointId);

    // Step 2: Check endpoint status
    if (endpoint.status !== 'active') {
      throw new ConflictException(`Endpoint ${endpointId} is not active`);
    }

    // Step 3: Verify HMAC signature (verifySignature handles missing/empty secret)
    if (endpoint.secret) {
      const isValid = verifySignature(rawBody, signature ?? '', endpoint.secret);

      if (!isValid) {
        throw new BadRequestException('invalid_signature');
      }
    }

    // Step 4: Generate IDs
    const eventId = ulid();
    const traceId = ulid();
    const receivedAt = new Date().toISOString();

    // Step 5: Persist event
    let savedEvent: HookMateEvent;

    try {
      savedEvent = await this.eventsService.create({
        id: eventId,
        endpointId,
        payload: JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>,
        headers,
        sourceIp,
        status: 'received',
        traceId,
      });
    } catch (error) {
      throw new ServiceUnavailableException(`Failed to persist event: ${(error as Error).message}`);
    }

    // Step 6: Publish SQS message (fire-and-forget)
    try {
      await this.sqsService.publish({
        event_id: savedEvent.id,
        endpoint_id: endpointId,
        trace_id: traceId,
        received_at: receivedAt,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish SQS message for event ${eventId}: ${(error as Error).message}`,
      );
    }

    return {
      event_id: eventId,
      trace_id: traceId,
      received_at: receivedAt,
    };
  }
}
