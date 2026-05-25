import type { HookMateAiSummary } from '@hookmate/shared';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { AiSummary } from './entities/ai-summary.entity';
import type { AiSummaryJobData } from './ai-summaries.types';

export interface GenerateSummaryResult {
  jobId: string;
}

export interface UpsertAiSummaryInput {
  endpointId: string;
  periodStart: string;
  periodEnd: string;
  summaryText: string;
  eventCount: number | null;
  failureCount: number | null;
  topCategories: Record<string, number> | null;
  model: string | null;
}

@Injectable()
export class AiSummariesService {
  constructor(
    @InjectRepository(AiSummary)
    private readonly repo: Repository<AiSummary>,
    @InjectQueue('ai-summaries')
    private readonly aiSummariesQueue: Queue,
  ) {}

  async list(): Promise<HookMateAiSummary[]> {
    const entities = await this.repo.find({ order: { generatedAt: 'DESC' } });

    return entities.map((entity) => entity.toPrimitive());
  }

  async getById(id: number): Promise<HookMateAiSummary> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`AiSummary ${id} was not found.`);
    }

    return entity.toPrimitive();
  }

  async listByEndpoint(
    endpointId: string,
    from?: string,
    to?: string,
  ): Promise<HookMateAiSummary[]> {
    const qb = this.repo.createQueryBuilder('summary');

    qb.andWhere('summary.endpointId = :endpointId', { endpointId });

    if (from) {
      qb.andWhere('summary.periodStart >= :from', { from });
    }

    if (to) {
      qb.andWhere('summary.periodEnd <= :to', { to });
    }

    qb.orderBy('summary.generatedAt', 'DESC');

    const entities = await qb.getMany();

    return entities.map((entity) => entity.toPrimitive());
  }

  /**
   * Upsert an AI summary for an endpoint + period combination.
   * Uses TypeORM upsert with conflict on the composite unique constraint.
   */
  async upsert(input: UpsertAiSummaryInput): Promise<HookMateAiSummary> {
    const entity = this.repo.create({
      endpointId: { id: input.endpointId } as never,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      summaryText: input.summaryText,
      eventCount: input.eventCount,
      failureCount: input.failureCount,
      topCategories: input.topCategories,
      model: input.model,
    });

    await this.repo.upsert(entity, ['endpointId', 'periodStart']);

    // Return a primitive representation of what was upserted
    return entity.toPrimitive();
  }

  /**
   * Enqueue an on-demand summary generation job for the given endpoint.
   * Returns a BullMQ job ID.
   */
  async generateOnDemand(endpointId: string): Promise<GenerateSummaryResult> {
    const job = await this.aiSummariesQueue.add('generate-summary', {
      jobType: 'on-demand',
      endpointId,
    } satisfies AiSummaryJobData);

    return { jobId: String(job.id) };
  }
}
