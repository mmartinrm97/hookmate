import { describe, expect, it } from 'vitest';
import { DlqEvent } from './dlq-event.entity';

describe('DlqEvent', () => {
  describe('generateId (@BeforeInsert)', () => {
    it('generates ULID id when id is not set', () => {
      const dlqEvent = new DlqEvent();
      dlqEvent.generateId();

      expect(dlqEvent.id).toBeDefined();
      expect(dlqEvent.id).toHaveLength(26);
      expect(dlqEvent.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('does not override existing id', () => {
      const dlqEvent = new DlqEvent();
      dlqEvent.id = 'existing-id';

      dlqEvent.generateId();

      expect(dlqEvent.id).toBe('existing-id');
    });
  });

  describe('toPrimitive', () => {
    it('converts to HookMateDlqEvent shape with ISO date strings', () => {
      const dlqEvent = new DlqEvent();
      dlqEvent.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      (dlqEvent as unknown as Record<string, unknown>).eventId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      (dlqEvent as unknown as Record<string, unknown>).endpointId = '01ARZ4NDEKTSV4RRFFQ69G5FAX';
      dlqEvent.failureReason = 'Max retries exceeded (5/5)';
      dlqEvent.attemptsJson = [
        { attempt: 1, status: 500, timestamp: '2024-01-01T00:00:00Z' },
        { attempt: 2, status: 502, timestamp: '2024-01-01T00:00:10Z' },
      ];
      dlqEvent.endpointSnapshot = {
        name: 'Billing webhook',
        destinationUrl: 'https://example.com/billing',
      };
      dlqEvent.createdAt = new Date('2024-01-01T00:01:00.000Z');
      dlqEvent.retriedAt = new Date('2024-01-02T00:00:00.000Z');

      const primitive = dlqEvent.toPrimitive();

      expect(primitive).toEqual({
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        eventId: '01ARYZ3NDEKTSV4RRFFQ69G5FAW',
        endpointId: '01ARZ4NDEKTSV4RRFFQ69G5FAX',
        failureReason: 'Max retries exceeded (5/5)',
        attemptsJson: [
          { attempt: 1, status: 500, timestamp: '2024-01-01T00:00:00Z' },
          { attempt: 2, status: 502, timestamp: '2024-01-01T00:00:10Z' },
        ],
        endpointSnapshot: {
          name: 'Billing webhook',
          destinationUrl: 'https://example.com/billing',
        },
        createdAt: '2024-01-01T00:01:00.000Z',
        retriedAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('handles null fields', () => {
      const dlqEvent = new DlqEvent();
      dlqEvent.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      (dlqEvent as unknown as Record<string, unknown>).eventId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      (dlqEvent as unknown as Record<string, unknown>).endpointId = '01ARZ4NDEKTSV4RRFFQ69G5FAX';
      dlqEvent.failureReason = null;
      dlqEvent.attemptsJson = [{ attempt: 1, error: 'Connection refused' }];
      dlqEvent.endpointSnapshot = { name: 'Test' };
      dlqEvent.createdAt = new Date('2024-01-01T00:01:00.000Z');
      dlqEvent.retriedAt = null;

      const primitive = dlqEvent.toPrimitive();

      expect(primitive.failureReason).toBeNull();
      expect(primitive.retriedAt).toBeNull();
    });
  });
});
