import type { HookMateDlqEvent } from '@hookmate/shared';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListDlqDto } from './dto/list-dlq.dto';
import type { DlqRetryAllResult, DlqRetryResult } from './dlq-events.service';
import { DlqEventsService } from './dlq-events.service';

@ApiTags('dlq')
@Controller({ path: 'dlq', version: '1' })
export class DlqEventsController {
  constructor(@Inject(DlqEventsService) private readonly dlqEventsService: DlqEventsService) {}

  @ApiOperation({ summary: 'List DLQ events, optionally filtered by endpoint_id' })
  @ApiOkResponse({ description: 'List of DLQ events.' })
  @Get()
  async list(@Query() query: ListDlqDto): Promise<HookMateDlqEvent[]> {
    return this.dlqEventsService.listByEndpointId(query.endpointId);
  }

  @ApiOperation({ summary: 'Retry all DLQ events for an endpoint (capped at 500)' })
  @ApiOkResponse({ description: 'Retry count.' })
  @Post('retry-all')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryAll(@Query('endpoint_id') endpointId?: string): Promise<DlqRetryAllResult> {
    if (!endpointId) {
      throw new BadRequestException('endpoint_id query parameter is required.');
    }

    return this.dlqEventsService.retryAll(endpointId);
  }

  @ApiOperation({ summary: 'Retry a single DLQ event by id' })
  @ApiOkResponse({ description: 'Retry job id.' })
  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retry(@Param('id') id: string): Promise<DlqRetryResult> {
    return this.dlqEventsService.retry(id);
  }

  @ApiOperation({ summary: 'Purge all DLQ events for an endpoint (requires x-confirm header)' })
  @ApiNoContentResponse({ description: 'DLQ events purged.' })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async purge(
    @Headers('x-confirm') confirm: string | undefined,
    @Query('endpoint_id') endpointId?: string,
  ): Promise<void> {
    if (confirm !== 'true') {
      throw new BadRequestException('x-confirm header must be set to "true" to purge DLQ.');
    }

    if (!endpointId) {
      throw new BadRequestException('endpoint_id query parameter is required.');
    }

    await this.dlqEventsService.purgeByEndpointId(endpointId);
  }
}
