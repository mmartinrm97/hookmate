import { Injectable } from '@nestjs/common';
import axios from 'axios';
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

      return {
        status: response.status >= 200 && response.status < 300 ? 'success' : 'failed',
        httpStatus: response.status,
        latencyMs,
        responseBody,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;

      const axiosError = error as { code?: string; response?: { status?: number } };

      if (axiosError.code === 'ECONNABORTED') {
        return { status: 'timeout', httpStatus: null, latencyMs, responseBody: null };
      }

      return {
        status: 'failed',
        httpStatus: axiosError.response?.status ?? null,
        latencyMs,
        responseBody: null,
      };
    }
  }

  private truncateResponse(data: unknown): string | null {
    if (data === undefined || data === null) {
      return null;
    }

    const body = typeof data === 'string' ? data : JSON.stringify(data);

    return body.length > 4096 ? body.substring(0, 4096) : body;
  }
}
