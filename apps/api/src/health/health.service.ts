import type { HookMateHealthSnapshot } from '@hookmate/shared';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../core/config/app-config.service';

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
