import { describe, expect, it } from 'vitest';
import { RoutingRule } from './routing-rule.entity';

describe('RoutingRule', () => {
  describe('toPrimitive', () => {
    it('converts to HookMateRoutingRule shape with ISO date strings', () => {
      const rule = new RoutingRule();
      rule.id = 42;
      (rule as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      rule.priority = 10;
      rule.matchType = 'header';
      rule.matchKey = 'X-Custom-Header';
      rule.matchValue = 'webhook-v2';
      rule.destinationType = 'http';
      rule.destinationUrl = 'https://example.com/webhook';
      rule.createdAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = rule.toPrimitive();

      expect(primitive).toEqual({
        id: 42,
        endpointId: '01ARYZ3NDEKTSV4RRFFQ69G5FAW',
        priority: 10,
        matchType: 'header',
        matchKey: 'X-Custom-Header',
        matchValue: 'webhook-v2',
        destinationType: 'http',
        destinationUrl: 'https://example.com/webhook',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('handles null optional fields', () => {
      const rule = new RoutingRule();
      rule.id = 7;
      (rule as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      rule.priority = 0;
      rule.matchType = 'source_ip';
      rule.matchKey = null;
      rule.matchValue = null;
      rule.destinationType = null;
      rule.destinationUrl = null;
      rule.createdAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = rule.toPrimitive();

      expect(primitive.matchKey).toBeNull();
      expect(primitive.matchValue).toBeNull();
      expect(primitive.destinationType).toBeNull();
      expect(primitive.destinationUrl).toBeNull();
    });

    it('handles discard destination type', () => {
      const rule = new RoutingRule();
      rule.id = 1;
      (rule as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      rule.priority = 99;
      rule.matchType = 'json_path';
      rule.matchKey = '$.event.type';
      rule.matchValue = 'debug';
      rule.destinationType = 'discard';
      rule.destinationUrl = null;
      rule.createdAt = new Date('2024-01-01T00:00:00.000Z');

      const primitive = rule.toPrimitive();

      expect(primitive.destinationType).toBe('discard');
      expect(primitive.destinationUrl).toBeNull();
    });
  });
});
