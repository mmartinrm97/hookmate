import { describe, expect, it, beforeEach } from 'vitest';
import { EndpointsService } from './endpoints.service.js';

describe('EndpointsService', () => {
  let service: EndpointsService;

  beforeEach(() => {
    service = new EndpointsService();
  });

  it('creates and lists endpoints', () => {
    const endpoint = service.create({
      name: 'Billing webhook',
      destinationUrl: 'https://example.com/webhooks/billing',
    });

    const endpoints = service.list();

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      id: endpoint.id,
      name: 'Billing webhook',
      destinationUrl: 'https://example.com/webhooks/billing',
      status: 'active',
      maxRetries: 5,
      retryBaseDelayMs: 5000,
      dlqThreshold: 100,
    });
  });

  it('pauses and resumes an endpoint', () => {
    const endpoint = service.create({
      name: 'Ops webhook',
      destinationUrl: 'https://example.com/webhooks/ops',
    });

    const paused = service.pause(endpoint.id);
    const resumed = service.resume(endpoint.id);

    expect(paused.status).toBe('paused');
    expect(resumed.status).toBe('active');
  });
});
