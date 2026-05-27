import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Controller({ version: '1' })
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(TypeOrmHealthIndicator) private readonly db: TypeOrmHealthIndicator,
    @Inject(MemoryHealthIndicator) private readonly memory: MemoryHealthIndicator,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Read API health status' })
  @Get('health')
  @HealthCheck()
  async getHealth() {
    const result = await this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
    return { ...result, service: 'hookmate-api' };
  }

  @Public()
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
