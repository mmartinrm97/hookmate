import { Controller, Get, Inject } from '@nestjs/common';
import type { HookMateHealthSnapshot } from '@hookmate/shared';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller({ version: '1' })
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @ApiOperation({ summary: 'Read API health status' })
  @Get('health')
  getHealth(): HookMateHealthSnapshot & { status: 'ok' } {
    return this.healthService.getSnapshot();
  }

  @ApiOperation({ summary: 'Read API entrypoint metadata' })
  @Get()
  getRoot(): { docs: string; endpoints: string; health: string; service: string } {
    return {
      service: 'hookmate-api',
      health: '/api/v1/health',
      endpoints: '/api/v1/endpoints',
      docs: '/api/docs',
    };
  }
}
