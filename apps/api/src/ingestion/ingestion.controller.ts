import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
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
  addContentTypeParser(
    contentType: string,
    opts: { parseAs: string },
    handler: (
      req: FastifyRequestLike,
      body: Buffer,
      done: (err: Error | null, body: Buffer) => void,
    ) => void,
  ): void;
  post(
    url: string,
    handler: (request: FastifyRequestLike, reply: FastifyReplyLike) => Promise<void>,
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

    // Register content type parser for raw body access
    fastifyInstance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (
        _req: FastifyRequestLike,
        body: Buffer,
        _done: (err: Error | null, body: Buffer) => void,
      ) => {
        _done(null, body);
      },
    );

    // Register ingestion route (outside /api/ prefix)
    fastifyInstance.post('/webhooks/:endpointId', async (request, reply) => {
      const { endpointId } = request.params;
      const rawBody = request.body as Buffer;
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
    });
  }
}
