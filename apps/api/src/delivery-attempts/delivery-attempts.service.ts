import type { HookMateDeliveryAttempt, HookMateDeliveryAttemptStatus } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryAttempt } from './entities/delivery-attempt.entity';

export interface CreateDeliveryAttemptInput {
  eventId: string;
  attemptNumber: number;
  destinationUrl: string;
  httpStatus: number | null;
  responseBody: string | null;
  latencyMs: number | null;
  status: HookMateDeliveryAttemptStatus;
}

@Injectable()
export class DeliveryAttemptsService {
  constructor(
    @InjectRepository(DeliveryAttempt)
    private readonly repo: Repository<DeliveryAttempt>,
  ) {}

  async list(): Promise<HookMateDeliveryAttempt[]> {
    const entities = await this.repo.find({ order: { attemptedAt: 'DESC' } });

    return entities.map((entity) => entity.toPrimitive());
  }

  async getById(id: number): Promise<HookMateDeliveryAttempt> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`DeliveryAttempt ${id} was not found.`);
    }

    return entity.toPrimitive();
  }

  async create(input: CreateDeliveryAttemptInput): Promise<HookMateDeliveryAttempt> {
    const entity = this.repo.create({
      eventId: { id: input.eventId } as never,
      attemptNumber: input.attemptNumber,
      destinationUrl: input.destinationUrl,
      httpStatus: input.httpStatus,
      responseBody: input.responseBody,
      latencyMs: input.latencyMs,
      status: input.status,
    });

    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
  }
}
