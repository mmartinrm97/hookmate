import type {
  CreateHookMateRoutingRuleInput,
  HookMateRoutingRule,
  UpdateHookMateRoutingRuleInput,
} from '@hookmate/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async create(
    endpointId: string,
    input: CreateHookMateRoutingRuleInput,
  ): Promise<HookMateRoutingRule> {
    const priorityVal = input.priority;

    const entity = this.repo.create({
      endpointId: { id: endpointId } as never,
      priority: input.priority,
      matchType: input.matchType,
      matchKey: input.matchKey ?? null,
      matchValue: input.matchValue ?? null,
      destinationType: input.destinationType ?? null,
      destinationUrl: input.destinationUrl ?? null,
    });

    try {
      const saved = await this.repo.save(entity);

      return saved.toPrimitive();
    } catch (err: unknown) {
      if ((err as Record<string, unknown>).code === '23505') {
        throw new ConflictException(
          `A routing rule with priority ${String(priorityVal)} already exists for this endpoint.`,
        );
      }
      throw err;
    }
  }

  async update(id: number, input: UpdateHookMateRoutingRuleInput): Promise<HookMateRoutingRule> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`RoutingRule ${id} was not found.`);
    }

    const patch = input as Record<string, unknown>;

    const fieldPriority = patch.priority as number | undefined;
    if (fieldPriority !== undefined) {
      entity.priority = fieldPriority;
    }

    const fieldMatchType = patch.matchType as string | undefined;
    if (fieldMatchType !== undefined) {
      entity.matchType = fieldMatchType as RoutingRule['matchType'];
    }

    const fieldMatchKey = patch.matchKey as string | null | undefined;
    if (fieldMatchKey !== undefined) {
      entity.matchKey = fieldMatchKey;
    }

    const fieldMatchValue = patch.matchValue as string | null | undefined;
    if (fieldMatchValue !== undefined) {
      entity.matchValue = fieldMatchValue;
    }

    const fieldDestType = patch.destinationType as string | null | undefined;
    if (fieldDestType !== undefined) {
      entity.destinationType = fieldDestType as RoutingRule['destinationType'];
    }

    const fieldDestUrl = patch.destinationUrl as string | null | undefined;
    if (fieldDestUrl !== undefined) {
      entity.destinationUrl = fieldDestUrl;
    }

    try {
      const saved = await this.repo.save(entity);

      return saved.toPrimitive();
    } catch (error: unknown) {
      if ((error as Record<string, unknown>).code === '23505') {
        throw new ConflictException(
          `A routing rule with priority ${entity.priority} already exists for this endpoint.`,
        );
      }
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`RoutingRule ${id} was not found.`);
    }

    await this.repo.delete(id);
  }
}
