import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListEventsDto } from './list-events.dto';

describe('ListEventsDto', () => {
  it('uses defaults when no query params provided', async () => {
    const dto = new ListEventsDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(50);
  });

  it('accepts valid endpointId, status, and page override', async () => {
    const dto = new ListEventsDto();
    dto.endpointId = 'ep-01JHQABC';
    dto.status = 'delivered';
    dto.page = 2;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts ISO date range filters', async () => {
    const dto = new ListEventsDto();
    dto.from = '2026-01-01T00:00:00.000Z';
    dto.to = '2026-01-15T23:59:59.000Z';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts category filter', async () => {
    const dto = new ListEventsDto();
    dto.category = 'billing';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid status value', async () => {
    const dto = new ListEventsDto();
    dto.status = 'invalid-status';

    const errors = await validate(dto);

    const statusErrors = errors.filter((e) => e.property === 'status');
    expect(statusErrors).toHaveLength(1);
  });

  it('rejects limit above maximum of 100', async () => {
    const dto = new ListEventsDto();
    dto.limit = 200;

    const errors = await validate(dto);

    const limitErrors = errors.filter((e) => e.property === 'limit');
    expect(limitErrors).toHaveLength(1);
  });

  it('rejects non-ISO date for from', async () => {
    const dto = new ListEventsDto();
    dto.from = 'not-a-date';

    const errors = await validate(dto);

    const fromErrors = errors.filter((e) => e.property === 'from');
    expect(fromErrors).toHaveLength(1);
  });
});
