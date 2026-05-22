import type { HookMateRoutingRule } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutingRule } from './entities/routing-rule.entity';

@Injectable()
export class RoutingRulesService {
  constructor(
    @InjectRepository(RoutingRule)
    private readonly repo: Repository<RoutingRule>,
  ) {}

  async list(): Promise<HookMateRoutingRule[]> {
    const entities = await this.repo.find({ order: { priority: 'ASC' } });

    return entities.map((entity) => entity.toPrimitive());
  }

  async getById(id: number): Promise<HookMateRoutingRule> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`RoutingRule ${id} was not found.`);
    }

    return entity.toPrimitive();
  }

  async getByEndpointId(endpointId: string): Promise<HookMateRoutingRule[]> {
    const entities = await this.repo.find({
      where: { endpointId: { id: endpointId } },
      order: { priority: 'ASC' },
    });

    return entities.map((entity) => entity.toPrimitive());
  }
}
