import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateRuleDto } from './update-rule.dto';

describe('UpdateRuleDto', () => {
  it('accepts partial update with only priority', async () => {
    const dto = new UpdateRuleDto();
    dto.priority = 15;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts partial update with only match fields', async () => {
    const dto = new UpdateRuleDto();
    dto.matchType = 'json_path';
    dto.matchKey = '$.event.type';
    dto.matchValue = 'billing';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts full update with all fields', async () => {
    const dto = new UpdateRuleDto();
    dto.priority = 30;
    dto.matchType = 'header';
    dto.matchKey = 'X-Custom';
    dto.matchValue = 'value';
    dto.destinationType = 'http';
    dto.destinationUrl = 'https://example.com/v2';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
