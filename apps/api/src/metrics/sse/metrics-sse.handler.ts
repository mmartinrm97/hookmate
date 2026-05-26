import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { SqsService } from '../../sqs/sqs.service';

const SSE_INTERVAL_MS = 5_000;
const SSE_RETRY_MS = 3_000;

interface FastifyReplyRaw {
  raw: {
    write(chunk: string): boolean;
    flushHeaders(): void;
  };
  header(name: string, value: string): FastifyReplyRaw;
  code(status: number): FastifyReplyRaw;
}

interface FastifyRequestRaw {
  raw: {
    on(event: 'close', listener: () => void): void;
  };
}

interface FastifyInstanceForSSE {
  get(
    url: string,
    handler: (request: FastifyRequestRaw, reply: FastifyReplyRaw) => Promise<void>,
  ): void;
}

@Injectable()
export class MetricsSseHandler implements OnApplicationBootstrap {
  private readonly logger = new Logger(MetricsSseHandler.name);
  private readonly intervals = new Set<NodeJS.Timeout>();

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly sqsService: SqsService,
  ) {}

  onApplicationBootstrap(): void {
    const fastify = this.httpAdapterHost.httpAdapter.getInstance() as FastifyInstanceForSSE;

    fastify.get('/api/metrics/stream', async (_request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive');

      reply.raw.flushHeaders();

      const intervalId = setInterval(async () => {
        const depth = await this.sqsService.getQueueDepth();
        const data = `data: ${JSON.stringify({ type: 'queue-depth', ...depth })}\n\n`;

        if (!reply.raw.write(data)) {
          this.logger.warn('SSE write backpressure — pausing briefly');
        }
      }, SSE_INTERVAL_MS);

      this.intervals.add(intervalId);

      // Send initial event immediately
      const initialDepth = await this.sqsService.getQueueDepth();
      reply.raw.write(`data: ${JSON.stringify({ type: 'queue-depth', ...initialDepth })}\n\n`);

      // Send retry hint
      reply.raw.write(`retry: ${SSE_RETRY_MS}\n\n`);

      // Clean up on client disconnect
      _request.raw.on('close', () => {
        clearInterval(intervalId);
        this.intervals.delete(intervalId);
        this.logger.debug('SSE client disconnected');
      });
    });
  }
}
