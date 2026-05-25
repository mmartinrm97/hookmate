import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EndpointMetricsDto } from './dto/endpoint-metrics.dto';
import type { SystemMetricsDto } from './dto/system-metrics.dto';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly metricsService: MetricsService) {}

  @ApiOperation({ summary: 'Get system-wide metrics' })
  @ApiOkResponse({ description: 'System metrics.' })
  @Get('system')
  async system(): Promise<SystemMetricsDto> {
    return this.metricsService.systemMetrics();
  }

  @ApiOperation({ summary: 'Get per-endpoint metrics' })
  @ApiOkResponse({ description: 'Endpoint metrics.' })
  @Get('endpoint/:id')
  async endpoint(@Param('id') id: string): Promise<EndpointMetricsDto> {
    return this.metricsService.endpointMetrics(id);
  }
}
