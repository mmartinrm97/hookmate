import type { HookMateRoutingRule } from '@hookmate/shared';
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
import { EndpointsService } from '../endpoints/endpoints.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { RoutingRulesService } from './routing-rules.service';

@ApiTags('routing-rules')
@Controller({ version: '1' })
export class RoutingRulesController {
  constructor(
    @Inject(RoutingRulesService) private readonly routingRulesService: RoutingRulesService,
    @Inject(EndpointsService) private readonly endpointsService: EndpointsService,
  ) {}

  @ApiOperation({ summary: 'List routing rules for an endpoint (ordered by priority)' })
  @ApiOkResponse({ description: 'List of routing rules.' })
  @Get('endpoints/:id/rules')
  async listRules(@Param('id') endpointId: string): Promise<HookMateRoutingRule[]> {
    // Verify endpoint exists
    await this.endpointsService.getById(endpointId);

    return this.routingRulesService.getByEndpointId(endpointId);
  }

  @ApiOperation({ summary: 'Create a routing rule for an endpoint' })
  @ApiCreatedResponse({ description: 'Routing rule created.' })
  @Post('endpoints/:id/rules')
  @HttpCode(HttpStatus.CREATED)
  async createRule(
    @Param('id') endpointId: string,
    @Body() body: CreateRuleDto,
  ): Promise<HookMateRoutingRule> {
    // Verify endpoint exists
    await this.endpointsService.getById(endpointId);

    return this.routingRulesService.create(endpointId, body);
  }

  @ApiOperation({ summary: 'Update a routing rule' })
  @ApiOkResponse({ description: 'Routing rule updated.' })
  @Patch('rules/:ruleId')
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() body: UpdateRuleDto,
  ): Promise<HookMateRoutingRule> {
    return this.routingRulesService.update(Number(ruleId), body);
  }

  @ApiOperation({ summary: 'Delete a routing rule' })
  @ApiNoContentResponse({ description: 'Routing rule deleted.' })
  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Param('ruleId') ruleId: string): Promise<void> {
    await this.routingRulesService.delete(Number(ruleId));
  }
}
