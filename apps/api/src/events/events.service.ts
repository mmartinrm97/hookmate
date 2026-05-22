import type { HookMateEvent, HookMateEventStatus } from '@hookmate/shared';
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

  async getById(id: string): Promise<HookMateEvent> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Event ${id} was not found.`);
    }

    return entity.toPrimitive();
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
