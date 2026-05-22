import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CreateHookMateEndpointInput,
  HookMateEndpoint,
  HookMateEndpointStatus,
} from '@hookmate/shared';
import { ulid } from 'ulid';
import { Endpoint } from './entities/endpoint.entity.js';

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_BASE_DELAY_MS = 5_000;
const DEFAULT_DLQ_THRESHOLD = 100;

@Injectable()
export class EndpointsService {
  constructor(
    @InjectRepository(Endpoint)
    private readonly repo: Repository<Endpoint>,
  ) {}

  async list(): Promise<HookMateEndpoint[]> {
    const entities = await this.repo.find({ order: { createdAt: 'DESC' } });

    return entities.map((entity) => entity.toPrimitive());
  }

  async getById(id: string): Promise<HookMateEndpoint> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Endpoint ${id} was not found.`);
    }

    return entity.toPrimitive();
  }

  async create(input: CreateHookMateEndpointInput): Promise<HookMateEndpoint> {
    this.assertCreateInput(input);

    const entity = this.repo.create({
      id: ulid(),
      name: input.name.trim(),
      destinationUrl: input.destinationUrl.trim(),
      secret: input.secret,
      status: 'active' as HookMateEndpointStatus,
      maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryBaseDelayMs: input.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
      dlqThreshold: input.dlqThreshold ?? DEFAULT_DLQ_THRESHOLD,
    });

    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
  }

  async pause(id: string): Promise<HookMateEndpoint> {
    return this.updateStatus(id, 'paused');
  }

  async resume(id: string): Promise<HookMateEndpoint> {
    return this.updateStatus(id, 'active');
  }

  private async updateStatus(
    id: string,
    status: HookMateEndpointStatus,
  ): Promise<HookMateEndpoint> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Endpoint ${id} was not found.`);
    }

    if (status === 'paused' && entity.status !== 'active') {
      throw new BadRequestException(
        `Cannot pause endpoint ${id}: current status is '${entity.status}', expected 'active'.`,
      );
    }

    if (status === 'active' && entity.status !== 'paused') {
      throw new BadRequestException(
        `Cannot resume endpoint ${id}: current status is '${entity.status}', expected 'paused'.`,
      );
    }

    entity.status = status;
    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
  }

  private assertCreateInput(input: CreateHookMateEndpointInput): void {
    if (!input.name.trim()) {
      throw new BadRequestException('Endpoint name is required.');
    }

    if (!input.destinationUrl.trim()) {
      throw new BadRequestException('Destination URL is required.');
    }

    let url: URL;

    try {
      url = new URL(input.destinationUrl);
    } catch {
      throw new BadRequestException('Destination URL must be a valid absolute URL.');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('Destination URL must use HTTP or HTTPS.');
    }
  }
}
