import type {
  CreateHookMateRoutingRuleInput,
  HookMateDestinationType,
  HookMateMatchType,
} from '@hookmate/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateRuleDto implements CreateHookMateRoutingRuleInput {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  priority!: number;

  @ApiProperty({ example: 'header' })
  @IsIn(['header', 'json_path', 'source_ip'])
  matchType!: HookMateMatchType;

  @ApiPropertyOptional({ example: 'X-Api-Key' })
  @IsOptional()
  @IsString()
  matchKey?: string | null;

  @ApiPropertyOptional({ example: 'sk-123' })
  @IsOptional()
  @IsString()
  matchValue?: string | null;

  @ApiPropertyOptional({ example: 'http' })
  @IsOptional()
  @IsIn(['http', 'slack', 'discord', 'discard'])
  destinationType?: HookMateDestinationType | null;

  @ApiPropertyOptional({ example: 'https://example.com/hook' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  destinationUrl?: string | null;
}
