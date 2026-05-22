import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import type { CreateHookMateEndpointInput } from '@hookmate/shared';

export class CreateEndpointDto implements CreateHookMateEndpointInput {
  @ApiProperty({ example: 'Billing endpoint' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'https://example.com/webhooks/billing' })
  @IsString()
  @IsUrl({ require_protocol: true })
  destinationUrl!: string;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxRetries?: number;

  @ApiPropertyOptional({ example: 5000, default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  retryBaseDelayMs?: number;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dlqThreshold?: number;
}
