import { describe, expect, it } from 'vitest';
import { DeliveryAttempt } from './delivery-attempt.entity';

describe('DeliveryAttempt', () => {
  describe('toPrimitive', () => {
    it('converts to HookMateDeliveryAttempt shape with ISO date strings', () => {
      const attempt = new DeliveryAttempt();
      attempt.id = 99;
      (attempt as unknown as Record<string, unknown>).eventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      attempt.attemptNumber = 1;
      attempt.destinationUrl = 'https://example.com/webhook';
      attempt.httpStatus = 200;
      attempt.responseBody = '{"ok":true}';
      attempt.latencyMs = 145;
      attempt.status = 'success';
      attempt.attemptedAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = attempt.toPrimitive();

      expect(primitive).toEqual({
        id: 99,
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        attemptNumber: 1,
        destinationUrl: 'https://example.com/webhook',
        httpStatus: 200,
        responseBody: '{"ok":true}',
        latencyMs: 145,
        status: 'success',
        attemptedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('handles null optional fields', () => {
      const attempt = new DeliveryAttempt();
      attempt.id = 100;
      (attempt as unknown as Record<string, unknown>).eventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      attempt.attemptNumber = 3;
      attempt.destinationUrl = 'https://example.com/timeout';
      attempt.httpStatus = null;
      attempt.responseBody = null;
      attempt.latencyMs = null;
      attempt.status = 'timeout';
      attempt.attemptedAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = attempt.toPrimitive();

      expect(primitive.httpStatus).toBeNull();
      expect(primitive.responseBody).toBeNull();
      expect(primitive.latencyMs).toBeNull();
    });

    it('handles failed delivery status', () => {
      const attempt = new DeliveryAttempt();
      attempt.id = 101;
      (attempt as unknown as Record<string, unknown>).eventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      attempt.attemptNumber = 2;
      attempt.destinationUrl = 'https://example.com/error';
      attempt.httpStatus = 500;
      attempt.responseBody = 'Internal Server Error';
      attempt.latencyMs = 2300;
      attempt.status = 'failed';
      attempt.attemptedAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = attempt.toPrimitive();

      expect(primitive.httpStatus).toBe(500);
      expect(primitive.responseBody).toBe('Internal Server Error');
      expect(primitive.status).toBe('failed');
    });
  });
});
