import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import type { HookMateEndpoint } from '@hookmate/shared';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateEndpointDto } from './dto/create-endpoint.dto.js';
import { EndpointsService } from './endpoints.service.js';

@ApiTags('endpoints')
@Controller({ path: 'endpoints', version: '1' })
export class EndpointsController {
  constructor(@Inject(EndpointsService) private readonly endpointsService: EndpointsService) {}

  @ApiOperation({ summary: 'List registered webhook endpoints' })
  @ApiOkResponse({ description: 'Current endpoints list.' })
  @Get()
  list(): HookMateEndpoint[] {
    return this.endpointsService.list();
  }

  @ApiOperation({ summary: 'Get a single endpoint by id' })
  @ApiOkResponse({ description: 'Endpoint detail.' })
  @Get(':id')
  getById(@Param('id') id: string): HookMateEndpoint {
    return this.endpointsService.getById(id);
  }

  @ApiOperation({ summary: 'Create a webhook endpoint' })
  @ApiCreatedResponse({ description: 'Endpoint created.' })
  @Post()
  create(@Body() body: CreateEndpointDto): HookMateEndpoint {
    return this.endpointsService.create(body);
  }

  @ApiOperation({ summary: 'Pause an endpoint' })
  @ApiOkResponse({ description: 'Endpoint paused.' })
  @Patch(':id/pause')
  pause(@Param('id') id: string): HookMateEndpoint {
    return this.endpointsService.pause(id);
  }

  @ApiOperation({ summary: 'Resume an endpoint' })
  @ApiOkResponse({ description: 'Endpoint resumed.' })
  @Patch(':id/resume')
  resume(@Param('id') id: string): HookMateEndpoint {
    return this.endpointsService.resume(id);
  }
}
