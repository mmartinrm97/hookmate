import type { HookMateEvent } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';

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
}
