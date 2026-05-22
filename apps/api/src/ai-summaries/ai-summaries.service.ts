import type { HookMateAiSummary } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSummary } from './entities/ai-summary.entity';

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
}
