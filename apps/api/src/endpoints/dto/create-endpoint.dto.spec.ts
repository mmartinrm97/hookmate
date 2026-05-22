import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateEndpointDto } from './create-endpoint.dto';

describe('CreateEndpointDto', () => {
  it('accepts valid secret', async () => {
    const dto = new CreateEndpointDto();
    dto.name = 'Test endpoint';
    dto.destinationUrl = 'https://example.com/webhook';
    dto.secret = 'whsec_abc123';

    const errors = await validate(dto);

    const secretErrors = errors.filter((e) => e.property === 'secret');
    expect(secretErrors).toHaveLength(0);
  });

  it('accepts undefined secret', async () => {
    const dto = new CreateEndpointDto();
    dto.name = 'Test endpoint';
    dto.destinationUrl = 'https://example.com/webhook';
    dto.secret = undefined;

    const errors = await validate(dto);

    const secretErrors = errors.filter((e) => e.property === 'secret');
    expect(secretErrors).toHaveLength(0);
  });

  it('rejects secret exceeding 255 characters', async () => {
    const dto = new CreateEndpointDto();
    dto.name = 'Test endpoint';
    dto.destinationUrl = 'https://example.com/webhook';
    dto.secret = 'a'.repeat(256);

    const errors = await validate(dto);

    const secretErrors = errors.filter((e) => e.property === 'secret');
    expect(secretErrors).toHaveLength(1);
    expect(secretErrors[0].constraints).toBeDefined();
  });
});
