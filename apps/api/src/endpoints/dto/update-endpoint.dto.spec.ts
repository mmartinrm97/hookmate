import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateEndpointDto } from './update-endpoint.dto';

describe('UpdateEndpointDto', () => {
  it('accepts a partial update with only name', async () => {
    const dto = new UpdateEndpointDto();
    dto.name = 'Updated name';

    const errors = await validate(dto);

    const nameErrors = errors.filter((e) => e.property === 'name');
    expect(nameErrors).toHaveLength(0);
  });

  it('accepts a partial update with only destinationUrl', async () => {
    const dto = new UpdateEndpointDto();
    dto.destinationUrl = 'https://updated.example.com/webhook';

    const errors = await validate(dto);

    const urlErrors = errors.filter((e) => e.property === 'destinationUrl');
    expect(urlErrors).toHaveLength(0);
  });

  it('accepts a full update with all fields', async () => {
    const dto = new UpdateEndpointDto();
    dto.name = 'Updated';
    dto.destinationUrl = 'https://example.com/new';
    dto.maxRetries = 3;
    dto.retryBaseDelayMs = 10_000;
    dto.dlqThreshold = 200;
    dto.secret = 'whsec_new_secret';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects destinationUrl when it is not a valid URL', async () => {
    const dto = new UpdateEndpointDto();
    dto.name = 'Test';
    dto.destinationUrl = 'not-a-url';

    const errors = await validate(dto);

    const urlErrors = errors.filter((e) => e.property === 'destinationUrl');
    expect(urlErrors).toHaveLength(1);
    expect(urlErrors[0]?.constraints).toBeDefined();
  });

  it('rejects secret exceeding 255 characters', async () => {
    const dto = new UpdateEndpointDto();
    dto.name = 'Test';
    dto.destinationUrl = 'https://example.com/webhook';
    dto.secret = 'a'.repeat(256);

    const errors = await validate(dto);

    const secretErrors = errors.filter((e) => e.property === 'secret');
    expect(secretErrors).toHaveLength(1);
    expect(secretErrors[0]?.constraints).toBeDefined();
  });
});
