import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Readable } from 'node:stream';
import { IngestionService } from './ingestion.service';

interface FastifyRequestLike {
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
  ip: string;
}

interface FastifyReplyLike {
  status(code: number): FastifyReplyLike;
  send(payload: unknown): Promise<void>;
}

interface FastifyInstanceLike {
  addHook(
    hook: 'preParsing',
    handler: (
      request: FastifyRequestLike,
      reply: FastifyReplyLike,
      payload: unknown,
      done: (err: Error | null, body?: unknown) => void,
    ) => void,
  ): void;
  post(
    url: string,
    opts: { bodyLimit: number },
    handler: (
      request: FastifyRequestLike & { rawBody?: Buffer },
      reply: FastifyReplyLike,
    ) => Promise<void>,
  ): void;
}

@Injectable()
export class IngestionController implements OnApplicationBootstrap {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly ingestionService: IngestionService,
  ) {}

  onApplicationBootstrap(): void {
    const fastifyInstance = this.httpAdapterHost.httpAdapter.getInstance() as FastifyInstanceLike;

    // Use preParsing hook to capture raw body as Buffer before the JSON parser consumes it
    // Attach rawBody to the request object for the ingestion handler to use
    fastifyInstance.addHook('preParsing', (request, _reply, payload, done) => {
      const req = request as FastifyRequestLike & { rawBody?: Buffer; url?: string };
      // Only capture raw body for webhook ingestion routes
      if (req.url?.startsWith('/webhooks/')) {
        // payload is the raw stream at this point
        const chunks: Buffer[] = [];
        const stream = payload as unknown as NodeJS.ReadableStream;
        stream.on('data', (chunk: unknown) => chunks.push(chunk as Buffer));
        stream.on('end', () => {
          req.rawBody = Buffer.concat(chunks);
          // Fastify's preParsing expects a Readable stream, not a Buffer.
          // Passing a Buffer causes Fastify to hang when trying to pipe it.
          done(null, Readable.from([req.rawBody]));
        });
        stream.on('error', (err: unknown) => done(err as Error | null));
      } else {
        done(null, payload);
      }
    });

    // Register ingestion route (outside /api/ prefix)
    fastifyInstance.post(
      '/webhooks/:endpointId',
      { bodyLimit: 10_485_760 }, // 10MB
      async (request, reply) => {
        const { endpointId } = request.params;
        const rawBody =
          (request as FastifyRequestLike & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
        const headers = request.headers;
        const sourceIp = headers['x-forwarded-for'] || request.ip || '';
        const signature = headers['x-hub-signature-256'];

        try {
          const result = await this.ingestionService.ingest({
            endpointId,
            rawBody,
            headers,
            sourceIp,
            signature,
          });

          await reply.status(202).send(result);
        } catch (error) {
          if (error instanceof NotFoundException) {
            await reply.status(404).send({ message: error.message });
          } else if (error instanceof BadRequestException) {
            await reply.status(400).send({ error: error.message });
          } else if (error instanceof ConflictException) {
            await reply.status(409).send({ message: error.message });
          } else if (error instanceof ServiceUnavailableException) {
            await reply.status(503).send({ message: error.message });
          } else {
            throw error;
          }
        }
      },
    );
  }
}
