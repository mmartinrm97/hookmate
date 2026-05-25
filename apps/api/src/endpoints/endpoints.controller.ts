import type { HookMateEndpoint } from '@hookmate/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { EndpointsService } from './endpoints.service';

@ApiTags('endpoints')
@Controller({ path: 'endpoints', version: '1' })
export class EndpointsController {
  constructor(@Inject(EndpointsService) private readonly endpointsService: EndpointsService) {}

  @ApiOperation({ summary: 'List registered webhook endpoints' })
  @ApiOkResponse({ description: 'Current endpoints list.' })
  @Get()
  async list(): Promise<HookMateEndpoint[]> {
    return this.endpointsService.list();
  }

  @ApiOperation({ summary: 'Get a single endpoint by id' })
  @ApiOkResponse({ description: 'Endpoint detail.' })
  @Get(':id')
  async getById(@Param('id') id: string): Promise<HookMateEndpoint> {
    return this.endpointsService.getById(id);
  }

  @ApiOperation({ summary: 'Create a webhook endpoint' })
  @ApiCreatedResponse({ description: 'Endpoint created.' })
  @Post()
  async create(@Body() body: CreateEndpointDto): Promise<HookMateEndpoint> {
    return this.endpointsService.create(body);
  }

  @ApiOperation({ summary: 'Update an endpoint (partial)' })
  @ApiOkResponse({ description: 'Endpoint updated.' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateEndpointDto,
  ): Promise<HookMateEndpoint> {
    return this.endpointsService.update(id, body);
  }

  @ApiOperation({ summary: 'Soft-delete an endpoint' })
  @ApiNoContentResponse({ description: 'Endpoint soft-deleted.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async softDelete(@Param('id') id: string): Promise<void> {
    await this.endpointsService.softDelete(id);
  }

  @ApiOperation({ summary: 'Pause an endpoint' })
  @ApiOkResponse({ description: 'Endpoint paused.' })
  @Patch(':id/pause')
  async pause(@Param('id') id: string): Promise<HookMateEndpoint> {
    return this.endpointsService.pause(id);
  }

  @ApiOperation({ summary: 'Resume an endpoint' })
  @ApiOkResponse({ description: 'Endpoint resumed.' })
  @Patch(':id/resume')
  async resume(@Param('id') id: string): Promise<HookMateEndpoint> {
    return this.endpointsService.resume(id);
  }
}
