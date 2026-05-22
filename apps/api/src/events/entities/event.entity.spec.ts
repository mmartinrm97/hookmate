import { describe, expect, it } from 'vitest';
import { Event } from './event.entity';

describe('Event', () => {
  describe('generateId (@BeforeInsert)', () => {
    it('generates ULID id when id is not set', () => {
      const event = new Event();
      event.generateId();

      expect(event.id).toBeDefined();
      expect(event.id).toHaveLength(26);
      expect(event.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('does not override existing id', () => {
      const event = new Event();
      event.id = 'existing-id';

      event.generateId();

      expect(event.id).toBe('existing-id');
    });
  });

  describe('toPrimitive', () => {
    it('converts to HookMateEvent shape with ISO date strings', () => {
      const event = new Event();
      event.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      (event as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      event.payload = { action: 'user.created', data: { userId: 42 } };
      event.headers = { 'content-type': 'application/json' };
      event.sourceIp = '192.168.1.1';
      event.status = 'received';
      event.category = 'user';
      event.traceId = 'trace-abc-123';
      event.receivedAt = new Date('2024-01-01T00:00:00.000Z');
      event.deliveredAt = new Date('2024-01-01T00:00:05.000Z');

      const primitive = event.toPrimitive();

      expect(primitive).toEqual({
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        endpointId: '01ARYZ3NDEKTSV4RRFFQ69G5FAW',
        payload: { action: 'user.created', data: { userId: 42 } },
        headers: { 'content-type': 'application/json' },
        sourceIp: '192.168.1.1',
        status: 'received',
        category: 'user',
        traceId: 'trace-abc-123',
        receivedAt: '2024-01-01T00:00:00.000Z',
        deliveredAt: '2024-01-01T00:00:05.000Z',
      });
    });

    it('handles null optional fields', () => {
      const event = new Event();
      event.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      (event as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      event.payload = { action: 'test' };
      event.headers = null;
      event.sourceIp = null;
      event.status = 'received';
      event.category = null;
      event.traceId = null;
      event.receivedAt = new Date('2024-01-01T00:00:00.000Z');
      event.deliveredAt = null;

      const primitive = event.toPrimitive();

      expect(primitive.headers).toBeNull();
      expect(primitive.sourceIp).toBeNull();
      expect(primitive.category).toBeNull();
      expect(primitive.traceId).toBeNull();
      expect(primitive.deliveredAt).toBeNull();
    });

    it('handles payload as empty object', () => {
      const event = new Event();
      event.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      (event as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      event.payload = {};
      event.headers = null;
      event.sourceIp = null;
      event.status = 'received';
      event.category = null;
      event.traceId = null;
      event.receivedAt = new Date('2024-01-01T00:00:00.000Z');
      event.deliveredAt = null;

      const primitive = event.toPrimitive();

      expect(primitive.payload).toEqual({});
    });
  });
});
