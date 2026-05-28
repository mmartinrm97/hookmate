import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bull';
import { CIRCUIT_BREAKER, ICircuitBreaker } from '../circuit-breaker/circuit-breaker.types';
import { DeliveryAttemptsService } from '../delivery-attempts/delivery-attempts.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { EventsService } from '../events/events.service';
import { RoutingRulesService } from '../routing-rules/routing-rules.service';
import { getTracer, OtelAttributes } from '../telemetry/telemetry';
import { DeliveryService } from './delivery.service';
import { DlqPromoterService } from './dlq-promoter.service';
import { RoutingEvaluatorService } from './routing-evaluator.service';
import type { DeliveryResult, ProcessInput, ProcessResult } from './processor.types';

const MAX_BACKOFF_MS = 3_600_000; // 1 hour cap

@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly endpointsService: EndpointsService,
    private readonly routingRulesService: RoutingRulesService,
    private readonly routingEvaluatorService: RoutingEvaluatorService,
    private readonly deliveryService: DeliveryService,
    private readonly deliveryAttemptsService: DeliveryAttemptsService,
    @InjectQueue('retries')
    private readonly retryQueue: Queue,
    private readonly dlqPromoterService: DlqPromoterService,
    @Inject(CIRCUIT_BREAKER)
    private readonly circuitBreaker: ICircuitBreaker,
  ) {}

  /**
   * Processes a webhook event through the delivery pipeline:
   * load event + endpoint → evaluate routing → deliver → record attempt → retry/DLQ
   */
  async process(input: ProcessInput): Promise<ProcessResult> {
    const tracer = getTracer();
    const { event_id, endpoint_id, attempt_number } = input;

    return tracer.startActiveSpan('hookmate.event.process', async (span) => {
      span.setAttribute(OtelAttributes.EVENT_ID, event_id);
      span.setAttribute(OtelAttributes.ENDPOINT_ID, endpoint_id);
      span.setAttribute(OtelAttributes.ATTEMPT_NUMBER, attempt_number);

      try {
        const event = await this.loadEvent(event_id);
        if (!event) {
          return {
            status: 'skipped' as const,
            eventId: event_id,
            endpointId: endpoint_id,
            attemptNumber: attempt_number,
          };
        }

        const endpoint = await this.loadEndpoint(endpoint_id);
        if (!endpoint) {
          return {
            status: 'skipped' as const,
            eventId: event_id,
            endpointId: endpoint_id,
            attemptNumber: attempt_number,
          };
        }

        // Skip paused endpoints
        if (endpoint.status === 'paused') {
          this.logger.log(`Endpoint ${endpoint_id} is paused — skipping event ${event_id}`);
          return {
            status: 'skipped' as const,
            eventId: event_id,
            endpointId: endpoint_id,
            attemptNumber: attempt_number,
          };
        }

        // Check circuit breaker state
        const cbResult = await this.circuitBreaker.checkState(endpoint_id);
        span.setAttribute('hookmate.circuit.state', cbResult.state);

        if (!cbResult.canProceed) {
          span.setAttribute(OtelAttributes.EVENT_STATUS, 'circuit_open');

          await this.deliveryAttemptsService.create({
            eventId: event_id,
            attemptNumber: attempt_number,
            destinationUrl: endpoint.destinationUrl,
            httpStatus: null,
            responseBody: null,
            latencyMs: 0,
            status: 'circuit_open' as const,
          });

          const failureReason = `Circuit open — failure rate exceeded, cooldown ${endpoint.cbCooldownSeconds}s`;
          await this.dlqPromoterService.promote(event, endpoint, [], failureReason);

          return {
            status: 'circuit_open' as const,
            eventId: event_id,
            endpointId: endpoint_id,
            attemptNumber: attempt_number,
          };
        }

        // Evaluate routing rules
        const rules = await this.routingRulesService.getByEndpointId(endpoint_id);
        const destinationUrl = this.routingEvaluatorService.evaluate(
          {
            payload: event.payload,
            headers: event.headers,
            sourceIp: event.sourceIp,
          },
          rules,
          endpoint.destinationUrl,
        );

        // Deliver payload
        const deliveryResult = await this.deliveryService.deliver(
          destinationUrl,
          event.payload,
          event_id,
        );

        // Record delivery attempt
        await this.deliveryAttemptsService.create({
          eventId: event_id,
          attemptNumber: attempt_number,
          destinationUrl,
          httpStatus: deliveryResult.httpStatus,
          responseBody: deliveryResult.responseBody,
          latencyMs: deliveryResult.latencyMs,
          status: deliveryResult.status,
        });

        // Handle result
        if (deliveryResult.status === 'success') {
          await this.circuitBreaker.recordSuccess(endpoint_id);
          await this.eventsService.updateStatus(event_id, 'delivered');
          span.setAttribute(OtelAttributes.EVENT_STATUS, 'delivered');
          return {
            status: 'delivered' as const,
            eventId: event_id,
            endpointId: endpoint_id,
            attemptNumber: attempt_number,
            destinationUrl,
          };
        }

        // Delivery failed — record in circuit breaker before retry/DLQ decision
        if (deliveryResult.status === 'failed' || deliveryResult.status === 'timeout') {
          await this.circuitBreaker.recordFailure(endpoint_id, {
            failureThreshold: endpoint.cbFailureThreshold ?? 0.8,
            windowSeconds: endpoint.cbWindowSeconds ?? 300,
            cooldownSeconds: endpoint.cbCooldownSeconds ?? 120,
          });
        }

        // Delivery failed — decide retry or DLQ
        if (attempt_number < endpoint.maxRetries) {
          await this.eventsService.updateStatus(event_id, 'failed');

          // Schedule retry with exponential backoff
          const delay = Math.min(
            endpoint.retryBaseDelayMs * Math.pow(2, attempt_number),
            MAX_BACKOFF_MS,
          );
          await this.retryQueue.add(
            'process-retry',
            {
              event_id,
              endpoint_id,
              attempt_number: attempt_number + 1,
            },
            { delay },
          );

          span.setAttribute(OtelAttributes.EVENT_STATUS, 'failed_retry');
          return {
            status: 'failed_retry' as const,
            eventId: event_id,
            endpointId: endpoint_id,
            attemptNumber: attempt_number,
            destinationUrl,
          };
        }

        // Max retries exhausted — promote to DLQ
        const failureReason = this.buildFailureReason(deliveryResult);
        await this.dlqPromoterService.promote(event, endpoint, [], failureReason);

        span.setAttribute(OtelAttributes.EVENT_STATUS, 'dead_lettered');
        return {
          status: 'dead_lettered' as const,
          eventId: event_id,
          endpointId: endpoint_id,
          attemptNumber: attempt_number,
          destinationUrl,
        };
      } catch (error) {
        span.recordException(error as Error);
        span.setAttribute(OtelAttributes.EVENT_STATUS, 'error');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private async loadEvent(
    eventId: string,
  ): Promise<import('@hookmate/shared').HookMateEvent | null> {
    try {
      return await this.eventsService.getById(eventId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Event ${eventId} not found — skipping (poison pill)`);
        return null;
      }
      throw error;
    }
  }

  private async loadEndpoint(
    endpointId: string,
  ): Promise<import('@hookmate/shared').HookMateEndpoint | null> {
    try {
      return await this.endpointsService.getById(endpointId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Endpoint ${endpointId} not found — skipping event`);
        return null;
      }
      throw error;
    }
  }

  private buildFailureReason(deliveryResult: DeliveryResult): string {
    if (deliveryResult.status === 'timeout') {
      return 'Delivery timeout — no response within 10s';
    }

    if (deliveryResult.httpStatus) {
      const statusText = this.httpStatusText(deliveryResult.httpStatus);
      return `HTTP ${deliveryResult.httpStatus} ${statusText}`;
    }

    return 'Delivery failed — unknown error';
  }

  private httpStatusText(status: number): string {
    const texts: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return texts[status] ?? 'Error';
  }
}
