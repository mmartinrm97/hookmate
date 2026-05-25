import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListSummariesDto } from './list-summaries.dto';

describe('ListSummariesDto', () => {
  it('accepts valid ISO dates', () => {
    const dto = plainToInstance(ListSummariesDto, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-08T00:00:00.000Z',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts empty input with defaults', () => {
    const dto = plainToInstance(ListSummariesDto, {});

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it('allows only from without to', () => {
    const dto = plainToInstance(ListSummariesDto, {
      from: '2026-01-01T00:00:00.000Z',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it('allows only to without from', () => {
    const dto = plainToInstance(ListSummariesDto, {
      to: '2026-01-08T00:00:00.000Z',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects non-ISO date', () => {
    const dto = plainToInstance(ListSummariesDto, {
      from: 'not-a-date',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('from');
  });

  it('rejects number as date', () => {
    const dto = plainToInstance(ListSummariesDto, {
      to: 12345,
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('to');
  });
});
