import type { HookMateDlqEvent } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DlqEvent } from './entities/dlq-event.entity';

@Injectable()
export class DlqEventsService {
  constructor(
    @InjectRepository(DlqEvent)
    private readonly repo: Repository<DlqEvent>,
  ) {}

  async list(): Promise<HookMateDlqEvent[]> {
    const entities = await this.repo.find({ order: { createdAt: 'DESC' } });

    return entities.map((entity) => entity.toPrimitive());
  }

  async getById(id: string): Promise<HookMateDlqEvent> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`DlqEvent ${id} was not found.`);
    }

    return entity.toPrimitive();
  }
}
