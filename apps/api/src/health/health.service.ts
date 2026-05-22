import { Inject, Injectable } from '@nestjs/common';
import type { HookMateHealthSnapshot } from '@hookmate/shared';
import { AppConfigService } from '../core/config/app-config.service.js';

@Injectable()
export class HealthService {
  constructor(@Inject(AppConfigService) private readonly appConfigService: AppConfigService) {}

  getSnapshot(): HookMateHealthSnapshot & { status: 'ok' } {
    const runtimeConfig = this.appConfigService.getRuntimeConfig();

    return {
      service: 'hookmate-api',
      status: 'ok',
      version: runtimeConfig.appVersion,
      environment: runtimeConfig.appEnv,
      region: runtimeConfig.awsRegion,
      timestamp: new Date().toISOString(),
    };
  }
}
