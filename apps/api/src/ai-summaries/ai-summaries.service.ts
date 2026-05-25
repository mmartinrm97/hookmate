import type { HookMateAiSummary } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSummary } from './entities/ai-summary.entity';

export interface GenerateSummaryResult {
  jobId: string;
}

@Injectable()
export class AiSummariesService {
  constructor(
    @InjectRepository(AiSummary)
    private readonly repo: Repository<AiSummary>,
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

  generateOnDemand(endpointId: string): GenerateSummaryResult {
    // STUB: No real OpenAI integration yet
    // In production, this would verify endpoint exists, enqueue a BullMQ job,
    // and return the job ID. For now, return a placeholder jobId.
    return { jobId: `stub-${endpointId}-${Date.now()}` };
  }
}
