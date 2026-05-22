import { ConfigService } from '@nestjs/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { AppConfigService } from '../core/config/app-config.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController(new HealthService(new AppConfigService(new ConfigService())));
  });

  it('returns the API root metadata', () => {
    expect(controller.getRoot()).toEqual({
      service: 'hookmate-api',
      health: '/api/v1/health',
      endpoints: '/api/v1/endpoints',
      docs: '/api/docs',
    });
  });

  it('returns an ok health snapshot', () => {
    const response = controller.getHealth();

    expect(response.service).toBe('hookmate-api');
    expect(response.status).toBe('ok');
    expect(response.region).toBeTruthy();
    expect(response.environment).toBeTruthy();
    expect(response.version).toBeTruthy();
    expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
  });
});
