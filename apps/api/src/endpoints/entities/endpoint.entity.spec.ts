import { describe, expect, it } from 'vitest';
import { Endpoint } from './endpoint.entity';

describe('Endpoint', () => {
  describe('generateId (@BeforeInsert)', () => {
    it('generates ULID id when id is not set', () => {
      const endpoint = new Endpoint();
      endpoint.name = 'Test endpoint';
      endpoint.destinationUrl = 'https://example.com/webhook';

      endpoint.generateId();

      expect(endpoint.id).toBeDefined();
      expect(endpoint.id).toHaveLength(26);
      expect(endpoint.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('does not override existing id', () => {
      const endpoint = new Endpoint();
      endpoint.id = 'existing-id';

      endpoint.generateId();

      expect(endpoint.id).toBe('existing-id');
    });
  });

  describe('toPrimitive', () => {
    it('converts to HookMateEndpoint shape with camelCase and ISO dates', () => {
      const endpoint = new Endpoint();
      endpoint.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      endpoint.name = 'Billing webhook';
      endpoint.destinationUrl = 'https://example.com/billing';
      endpoint.secret = 'whsec_abc123';
      endpoint.status = 'active';
      endpoint.maxRetries = 5;
      endpoint.retryBaseDelayMs = 5000;
      endpoint.dlqThreshold = 100;
      endpoint.createdAt = new Date('2024-01-01T00:00:00.000Z');
      endpoint.updatedAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = endpoint.toPrimitive();

      expect(primitive).toEqual({
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        name: 'Billing webhook',
        destinationUrl: 'https://example.com/billing',
        secret: 'whsec_abc123',
        status: 'active',
        maxRetries: 5,
        retryBaseDelayMs: 5000,
        dlqThreshold: 100,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('maps secret as undefined when null', () => {
      const endpoint = new Endpoint();
      endpoint.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      endpoint.name = 'Test';
      endpoint.destinationUrl = 'https://example.com/t';
      endpoint.secret = null as unknown as undefined;
      endpoint.status = 'active';
      endpoint.maxRetries = 5;
      endpoint.retryBaseDelayMs = 5000;
      endpoint.dlqThreshold = 100;
      endpoint.createdAt = new Date('2024-01-01T00:00:00.000Z');
      endpoint.updatedAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = endpoint.toPrimitive();

      expect(primitive.secret).toBeUndefined();
    });
  });
});
