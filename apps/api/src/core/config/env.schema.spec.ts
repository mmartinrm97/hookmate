import { describe, expect, it } from 'vitest';
import { envSchema } from './env.schema';

describe('envSchema', () => {
  it('provides default dev API_KEYS when not set', () => {
    const result = envSchema.parse({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test',
    });
    expect(result.API_KEYS).toBe('dev-key-123');
  });

  it('accepts custom API_KEYS value', () => {
    const result = envSchema.parse({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test',
      API_KEYS: 'custom-key-456',
    });
    expect(result.API_KEYS).toBe('custom-key-456');
  });

  it('parses comma-separated API_KEYS', () => {
    const result = envSchema.parse({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test',
      API_KEYS: 'key-1,key-2,key-3',
    });
    expect(result.API_KEYS).toBe('key-1,key-2,key-3');
  });
});
