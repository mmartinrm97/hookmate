import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateRuleDto } from './create-rule.dto';

describe('CreateRuleDto', () => {
  it('accepts valid http rule with all required fields', async () => {
    const dto = new CreateRuleDto();
    dto.priority = 10;
    dto.matchType = 'header';
    dto.matchKey = 'X-Api-Key';
    dto.matchValue = 'sk-123';
    dto.destinationType = 'http';
    dto.destinationUrl = 'https://example.com/hook';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts discard destination without url', async () => {
    const dto = new CreateRuleDto();
    dto.priority = 20;
    dto.matchType = 'json_path';
    dto.matchKey = '$.event.type';
    dto.matchValue = 'debug';
    dto.destinationType = 'discard';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid matchType', async () => {
    const dto = new CreateRuleDto();
    dto.priority = 10;
    (dto as Record<string, unknown>).matchType = 'invalid';

    const errors = await validate(dto);

    const typeErrors = errors.filter((e) => e.property === 'matchType');
    expect(typeErrors).toHaveLength(1);
  });

  it('rejects invalid destinationType', async () => {
    const dto = new CreateRuleDto();
    dto.priority = 10;
    dto.matchType = 'header';
    (dto as Record<string, unknown>).destinationType = 'invalid';

    const errors = await validate(dto);

    const typeErrors = errors.filter((e) => e.property === 'destinationType');
    expect(typeErrors).toHaveLength(1);
  });

  it('rejects empty string for destinationUrl', async () => {
    const dto = new CreateRuleDto();
    dto.priority = 10;
    dto.matchType = 'header';
    dto.destinationType = 'http';
    dto.destinationUrl = '';

    const errors = await validate(dto);

    const urlErrors = errors.filter((e) => e.property === 'destinationUrl');
    expect(urlErrors).toHaveLength(1);
  });
});
