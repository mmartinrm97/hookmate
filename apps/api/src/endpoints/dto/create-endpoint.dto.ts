import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
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

  @ApiPropertyOptional({ example: 'whsec_abc123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  secret?: string;

  @ApiPropertyOptional({ example: 0.8, default: 0.8, description: 'Failure rate threshold (0-1)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  cbFailureThreshold?: number;

  @ApiPropertyOptional({ example: 300, default: 300, description: 'Sliding window in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  cbWindowSeconds?: number;

  @ApiPropertyOptional({ example: 120, default: 120, description: 'Cooldown period in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  cbCooldownSeconds?: number;
}
