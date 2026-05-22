import type { HookMateDeliveryAttempt } from '@hookmate/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryAttempt } from './entities/delivery-attempt.entity';

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
}
