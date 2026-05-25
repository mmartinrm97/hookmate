import type { HookMateDlqEvent } from '@hookmate/shared';
import { InjectQueue } from '@nestjs/bull';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { DlqEvent } from './entities/dlq-event.entity';

export interface CreateDlqEventInput {
  eventId: string;
  endpointId: string;
  failureReason: string | null;
  attemptsJson: unknown[];
  endpointSnapshot: Record<string, unknown>;
}

export interface DlqRetryResult {
  jobId: string;
}

export interface DlqRetryAllResult {
  count: number;
}

const RETRY_ALL_CAP = 500;

function resolveRelationId(relation: unknown): string {
  if (typeof relation === 'object' && relation !== null) {
    return (relation as { id: string }).id;
  }
  return (relation as string) ?? '';
}

@Injectable()
export class DlqEventsService {
  constructor(
    @InjectRepository(DlqEvent)
    private readonly repo: Repository<DlqEvent>,
    @InjectQueue('retries')
    private readonly retryQueue: Queue,
  ) {}

  async list(): Promise<HookMateDlqEvent[]> {
    const entities = await this.repo.find({ order: { createdAt: 'DESC' } });

    return entities.map((entity) => entity.toPrimitive());
  }

  async listByEndpointId(endpointId?: string): Promise<HookMateDlqEvent[]> {
    const findOptions: Record<string, unknown> = {
      order: { createdAt: 'DESC' } as Record<string, unknown>,
    };

    if (endpointId) {
      findOptions.where = { endpointId: { id: endpointId } };
    }

    const entities = await this.repo.find(findOptions as Record<string, never>);

    return entities.map((entity) => entity.toPrimitive());
  }

  async getById(id: string): Promise<HookMateDlqEvent> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`DlqEvent ${id} was not found.`);
    }

    return entity.toPrimitive();
  }

  async create(input: CreateDlqEventInput): Promise<HookMateDlqEvent> {
    const entity = this.repo.create({
      eventId: { id: input.eventId } as never,
      endpointId: { id: input.endpointId } as never,
      failureReason: input.failureReason,
      attemptsJson: input.attemptsJson,
      endpointSnapshot: input.endpointSnapshot,
    });

    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
  }

  async retry(id: string): Promise<DlqRetryResult> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`DlqEvent ${id} was not found.`);
    }

    if (entity.retriedAt) {
      throw new ConflictException(`DlqEvent ${id} has already been retried.`);
    }

    const eventId = resolveRelationId(entity.eventId);
    const endpointId = resolveRelationId(entity.endpointId);

    const job = await this.retryQueue.add('process-retry', {
      event_id: eventId,
      endpoint_id: endpointId,
      attempt_number: 1,
    });

    entity.retriedAt = new Date();
    await this.repo.save(entity);

    return { jobId: job.id as string };
  }

  async retryAll(endpointId: string): Promise<DlqRetryAllResult> {
    const entities = await this.repo.find({
      where: { endpointId: { id: endpointId } },
    });

    const toRetry = entities.slice(0, RETRY_ALL_CAP);

    for (const entity of toRetry) {
      const eventId = resolveRelationId(entity.eventId);
      const epId = resolveRelationId(entity.endpointId);

      await this.retryQueue.add('process-retry', {
        event_id: eventId,
        endpoint_id: epId,
        attempt_number: 1,
      });

      entity.retriedAt = new Date();
      await this.repo.save(entity);
    }

    return { count: toRetry.length };
  }

  async purgeByEndpointId(endpointId: string): Promise<void> {
    await this.repo.delete({ endpointId: { id: endpointId } });
  }
}
