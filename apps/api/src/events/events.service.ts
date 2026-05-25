import type { HookMateEvent, HookMateEventStatus, PaginatedResponse } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';

export interface CreateEventInput {
  id: string;
  endpointId: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string> | null;
  sourceIp?: string | null;
  status?: HookMateEventStatus;
  category?: string | null;
  traceId?: string | null;
}

export interface ListEventsFilters {
  endpointId?: string;
  status?: string;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
  ) {}

  async list(): Promise<HookMateEvent[]> {
    const entities = await this.repo.find({ order: { receivedAt: 'DESC' } });

    return entities.map((entity) => entity.toPrimitive());
  }

  async listFiltered(filters: ListEventsFilters): Promise<PaginatedResponse<HookMateEvent>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const qb = this.repo.createQueryBuilder('event');

    if (filters.endpointId) {
      qb.andWhere('event.endpointId = :endpointId', { endpointId: filters.endpointId });
    }

    if (filters.status) {
      qb.andWhere('event.status = :status', { status: filters.status });
    }

    if (filters.category) {
      qb.andWhere('event.category = :category', { category: filters.category });
    }

    if (filters.from && filters.to) {
      qb.andWhere('event.receivedAt BETWEEN :from AND :to', {
        from: filters.from,
        to: filters.to,
      });
    }

    qb.orderBy('event.receivedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [entities, total] = await qb.getManyAndCount();

    return {
      items: entities.map((entity) => entity.toPrimitive()),
      total,
      page,
      limit,
    };
  }

  async getById(id: string): Promise<HookMateEvent> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Event ${id} was not found.`);
    }

    return entity.toPrimitive();
  }

  async updateStatus(
    id: string,
    status: HookMateEventStatus,
    deliveredAt?: Date,
  ): Promise<HookMateEvent> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Event ${id} was not found.`);
    }

    entity.status = status;

    if (deliveredAt !== undefined) {
      entity.deliveredAt = deliveredAt;
    }

    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
  }

  async create(input: CreateEventInput): Promise<HookMateEvent> {
    const entity = this.repo.create({
      id: input.id,
      endpointId: { id: input.endpointId } as never,
      payload: input.payload,
      headers: input.headers ?? null,
      sourceIp: input.sourceIp ?? null,
      status: input.status ?? ('received' as HookMateEventStatus),
      category: input.category ?? null,
      traceId: input.traceId ?? null,
    });

    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
  }
}
