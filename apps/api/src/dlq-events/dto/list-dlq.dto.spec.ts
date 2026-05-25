import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListDlqDto } from './list-dlq.dto';

describe('ListDlqDto', () => {
  it('uses defaults when no query params provided', async () => {
    const dto = new ListDlqDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(50);
  });

  it('accepts valid endpointId and page override', async () => {
    const dto = new ListDlqDto();
    dto.endpointId = 'ep-01JHQABC';
    dto.page = 2;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts limit override within range', async () => {
    const dto = new ListDlqDto();
    dto.limit = 25;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects limit above maximum of 100', async () => {
    const dto = new ListDlqDto();
    dto.limit = 200;

    const errors = await validate(dto);

    const limitErrors = errors.filter((e) => e.property === 'limit');
    expect(limitErrors).toHaveLength(1);
  });

  it('rejects zero page', async () => {
    const dto = new ListDlqDto();
    dto.page = 0;

    const errors = await validate(dto);

    const pageErrors = errors.filter((e) => e.property === 'page');
    expect(pageErrors).toHaveLength(1);
  });
});
