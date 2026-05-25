import type { HookMateAiSummary } from '@hookmate/shared';
import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EndpointsService } from '../endpoints/endpoints.service';
import { AiSummariesService, type GenerateSummaryResult } from './ai-summaries.service';
import { ListSummariesDto } from './dto/list-summaries.dto';

@ApiTags('ai-summaries')
@Controller({ version: '1' })
export class AiSummariesController {
  constructor(
    @Inject(AiSummariesService) private readonly aiSummariesService: AiSummariesService,
    @Inject(EndpointsService) private readonly endpointsService: EndpointsService,
  ) {}

  @ApiOperation({ summary: 'List AI summaries for an endpoint with date filtering' })
  @ApiOkResponse({ description: 'List of AI summaries.' })
  @Get('endpoints/:id/summaries')
  async list(
    @Param('id') endpointId: string,
    @Query() query: ListSummariesDto,
  ): Promise<HookMateAiSummary[]> {
    // Verify endpoint exists
    await this.endpointsService.getById(endpointId);

    return this.aiSummariesService.listByEndpoint(endpointId, query.from, query.to);
  }

  @ApiOperation({ summary: 'Trigger on-demand AI summary generation' })
  @ApiOkResponse({ description: 'Generation job queued.' })
  @Post('endpoints/:id/summaries/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(@Param('id') endpointId: string): Promise<GenerateSummaryResult> {
    // Verify endpoint exists
    await this.endpointsService.getById(endpointId);

    return this.aiSummariesService.generateOnDemand(endpointId);
  }
}
