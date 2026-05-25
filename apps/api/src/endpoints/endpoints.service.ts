import type {
  CreateHookMateEndpointInput,
  HookMateEndpoint,
  HookMateEndpointStatus,
  UpdateHookMateEndpointInput,
} from '@hookmate/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ulid } from 'ulid';
import { Endpoint } from './entities/endpoint.entity';

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

  async update(id: string, input: UpdateHookMateEndpointInput): Promise<HookMateEndpoint> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Endpoint ${id} was not found.`);
    }

    // Use Record<string, unknown> to avoid oxlint mapped-type limitation
    const patch: Record<string, unknown> = input as Record<string, unknown>;

    const fieldName = patch.name as string | undefined;
    if (fieldName !== undefined) {
      entity.name = fieldName.trim();
    }

    const fieldUrl = patch.destinationUrl as string | undefined;
    if (fieldUrl !== undefined) {
      this.assertValidUrl(fieldUrl);
      entity.destinationUrl = fieldUrl.trim();
    }

    const fieldSecret = patch.secret as string | undefined;
    if (fieldSecret !== undefined) {
      entity.secret = fieldSecret;
    }

    const fieldRetries = patch.maxRetries as number | undefined;
    if (fieldRetries !== undefined) {
      entity.maxRetries = fieldRetries;
    }

    const fieldDelay = patch.retryBaseDelayMs as number | undefined;
    if (fieldDelay !== undefined) {
      entity.retryBaseDelayMs = fieldDelay;
    }

    const fieldThreshold = patch.dlqThreshold as number | undefined;
    if (fieldThreshold !== undefined) {
      entity.dlqThreshold = fieldThreshold;
    }

    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
  }

  async softDelete(id: string): Promise<HookMateEndpoint> {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Endpoint ${id} was not found.`);
    }

    entity.status = 'deleted' as HookMateEndpointStatus;
    const saved = await this.repo.save(entity);

    return saved.toPrimitive();
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

    this.assertValidUrl(input.destinationUrl);
  }

  private assertValidUrl(url: string): void {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Destination URL must be a valid absolute URL.');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Destination URL must use HTTP or HTTPS.');
    }
  }
}
