import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { getTracer, OtelAttributes } from '../telemetry/telemetry';
import type { DeliveryResult } from './processor.types';

@Injectable()
export class DeliveryService {
  /**
   * POSTs the event payload to the destination URL with a 10s timeout.
   * NEVER throws — always returns a DeliveryResult with status, httpStatus, latencyMs, and responseBody.
   */
  async deliver(
    destinationUrl: string,
    payload: Record<string, unknown>,
    eventId: string,
  ): Promise<DeliveryResult> {
    const tracer = getTracer();

    return tracer.startActiveSpan('hookmate.delivery.attempt', async (span) => {
      span.setAttribute(OtelAttributes.DELIVERY_URL, destinationUrl);
      span.setAttribute(OtelAttributes.EVENT_ID, eventId);

      const start = Date.now();

      try {
        const response = await axios.post(destinationUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-HookMate-Event-Id': eventId,
          },
          timeout: 10_000,
        });

        const latencyMs = Date.now() - start;
        const responseBody = this.truncateResponse(response.data);
        const status = response.status >= 200 && response.status < 300 ? 'success' : 'failed';

        span.setAttribute(OtelAttributes.DELIVERY_STATUS, status);
        if (response.status) {
          span.setAttribute('http.status_code', response.status);
        }
        span.setAttribute('http.response_time_ms', latencyMs);

        return {
          status,
          httpStatus: response.status,
          latencyMs,
          responseBody,
        };
      } catch (error) {
        const latencyMs = Date.now() - start;

        const axiosError = error as { code?: string; response?: { status?: number } };

        if (axiosError.code === 'ECONNABORTED') {
          span.setAttribute(OtelAttributes.DELIVERY_STATUS, 'timeout');
          span.recordException(new Error('Delivery timeout'));
          return { status: 'timeout', httpStatus: null, latencyMs, responseBody: null };
        }

        const httpStatus = axiosError.response?.status ?? null;
        span.setAttribute(OtelAttributes.DELIVERY_STATUS, 'failed');
        if (httpStatus) {
          span.setAttribute('http.status_code', httpStatus);
        }
        span.recordException(error as Error);

        return {
          status: 'failed',
          httpStatus,
          latencyMs,
          responseBody: null,
        };
      } finally {
        span.end();
      }
    });
  }

  private truncateResponse(data: unknown): string | null {
    if (data === undefined || data === null) {
      return null;
    }

    const body = typeof data === 'string' ? data : JSON.stringify(data);

    return body.length > 4096 ? body.substring(0, 4096) : body;
  }
}
