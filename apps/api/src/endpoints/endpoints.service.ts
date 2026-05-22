import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateHookMateEndpointInput,
  HookMateEndpoint,
  HookMateEndpointStatus,
} from '@hookmate/shared';
import { ulid } from 'ulid';

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_BASE_DELAY_MS = 5_000;
const DEFAULT_DLQ_THRESHOLD = 100;

@Injectable()
export class EndpointsService {
  private readonly endpoints = new Map<string, HookMateEndpoint>();

  list(): HookMateEndpoint[] {
    const endpoints = Array.from(this.endpoints.values());

    endpoints.sort((left: HookMateEndpoint, right: HookMateEndpoint) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    return endpoints;
  }

  getById(id: string): HookMateEndpoint {
    const endpoint = this.endpoints.get(id);

    if (!endpoint) {
      throw new NotFoundException(`Endpoint ${id} was not found.`);
    }

    return endpoint;
  }

  create(input: CreateHookMateEndpointInput): HookMateEndpoint {
    this.assertCreateInput(input);

    const now = new Date().toISOString();
    const endpoint: HookMateEndpoint = {
      id: ulid(),
      name: input.name.trim(),
      destinationUrl: input.destinationUrl.trim(),
      status: 'active',
      maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryBaseDelayMs: input.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
      dlqThreshold: input.dlqThreshold ?? DEFAULT_DLQ_THRESHOLD,
      createdAt: now,
      updatedAt: now,
    };

    this.endpoints.set(endpoint.id, endpoint);

    return endpoint;
  }

  pause(id: string): HookMateEndpoint {
    return this.updateStatus(id, 'paused');
  }

  resume(id: string): HookMateEndpoint {
    return this.updateStatus(id, 'active');
  }

  private updateStatus(id: string, status: HookMateEndpointStatus): HookMateEndpoint {
    const endpoint = this.getById(id);
    const updatedEndpoint: HookMateEndpoint = {
      ...endpoint,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.endpoints.set(id, updatedEndpoint);

    return updatedEndpoint;
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
