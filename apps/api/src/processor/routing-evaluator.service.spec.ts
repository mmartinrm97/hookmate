import type { HookMateRoutingRule } from '@hookmate/shared';
import { describe, expect, it } from 'vitest';
import { RoutingEvaluatorService } from './routing-evaluator.service';
import type { EvaluateInput } from './routing-evaluator.service';

function rule(overrides: Partial<HookMateRoutingRule>): HookMateRoutingRule {
  return {
    id: 1,
    endpointId: 'ep-01JHQ',
    priority: 10,
    matchType: 'header',
    matchKey: null,
    matchValue: null,
    destinationType: 'http',
    destinationUrl: 'https://default.example.com/hook',
    createdAt: '2026-01-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('RoutingEvaluatorService', () => {
  const service = new RoutingEvaluatorService();

  describe('header matching', () => {
    it('routes to rule destination when header matches', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: { 'X-Event-Type': 'payment.completed' },
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          id: 1,
          matchType: 'header',
          matchKey: 'X-Event-Type',
          matchValue: 'payment.completed',
          destinationUrl: 'https://payments.example.com/hook',
        }),
      ];
      const defaultUrl = 'https://default.example.com/hook';

      const result = service.evaluate(input, rules, defaultUrl);

      expect(result).toBe('https://payments.example.com/hook');
    });

    it('does not match when header key differs', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: { 'X-Other-Type': 'payment.completed' },
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'header',
          matchKey: 'X-Event-Type',
          matchValue: 'payment.completed',
          destinationUrl: 'https://payments.example.com/hook',
        }),
      ];
      const defaultUrl = 'https://default.example.com/hook';

      const result = service.evaluate(input, rules, defaultUrl);

      expect(result).toBe('https://default.example.com/hook');
    });

    it('does not match when header value differs', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: { 'X-Event-Type': 'user.signup' },
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'header',
          matchKey: 'X-Event-Type',
          matchValue: 'payment.completed',
          destinationUrl: 'https://payments.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });

    it('does not match when headers are null', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: null,
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'header',
          matchKey: 'X-Event-Type',
          matchValue: 'payment.completed',
          destinationUrl: 'https://payments.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });

    it('does not match when headers are missing the key', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: {},
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'header',
          matchKey: 'X-Event-Type',
          matchValue: 'payment.completed',
          destinationUrl: 'https://payments.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });
  });

  describe('json_path matching', () => {
    it('routes to rule destination when json path matches', () => {
      const input: EvaluateInput = {
        payload: { event: { type: 'user.signup' } },
        headers: null,
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'json_path',
          matchKey: '$.event.type',
          matchValue: 'user.signup',
          destinationUrl: 'https://signup.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://signup.example.com/hook');
    });

    it('does not match when json path value differs', () => {
      const input: EvaluateInput = {
        payload: { event: { type: 'payment.completed' } },
        headers: null,
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'json_path',
          matchKey: '$.event.type',
          matchValue: 'user.signup',
          destinationUrl: 'https://signup.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });

    it('does not match when json path expression returns empty', () => {
      const input: EvaluateInput = {
        payload: { unrelated: 'data' },
        headers: null,
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'json_path',
          matchKey: '$.event.type',
          matchValue: 'user.signup',
          destinationUrl: 'https://signup.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });

    it('matches with nested array path', () => {
      const input: EvaluateInput = {
        payload: { users: [{ name: 'alice' }, { name: 'bob' }] },
        headers: null,
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'json_path',
          matchKey: '$.users[*].name',
          matchValue: 'bob',
          destinationUrl: 'https://bob.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://bob.example.com/hook');
    });
  });

  describe('source_ip matching', () => {
    it('routes to rule destination when source IP matches', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: null,
        sourceIp: '192.168.1.1',
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'source_ip',
          matchValue: '192.168.1.1',
          destinationUrl: 'https://internal.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://internal.example.com/hook');
    });

    it('does not match when source IP differs', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: null,
        sourceIp: '10.0.0.1',
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'source_ip',
          matchValue: '192.168.1.1',
          destinationUrl: 'https://internal.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });

    it('does not match when source IP is null', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: null,
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'source_ip',
          matchValue: '192.168.1.1',
          destinationUrl: 'https://internal.example.com/hook',
        }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });
  });

  describe('priority ordering', () => {
    it('returns the first matching rule in priority order (lower = higher priority)', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: { 'X-Type': 'a' },
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          id: 2,
          priority: 1,
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'a',
          destinationUrl: '/high-priority',
        }),
        rule({
          id: 1,
          priority: 2,
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'a',
          destinationUrl: '/low-priority',
        }),
        rule({
          id: 3,
          priority: 3,
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'a',
          destinationUrl: '/lowest-priority',
        }),
      ];

      const result = service.evaluate(input, rules, '/default');

      expect(result).toBe('/high-priority');
    });

    it('stops at first match and does not evaluate remaining rules', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: { 'X-Type': 'b' },
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          id: 1,
          priority: 1,
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'a',
          destinationUrl: '/first',
        }),
        rule({
          id: 2,
          priority: 2,
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'b',
          destinationUrl: '/second',
        }),
        rule({
          id: 3,
          priority: 3,
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'c',
          destinationUrl: '/third',
        }),
      ];

      const result = service.evaluate(input, rules, '/default');

      expect(result).toBe('/second');
    });
  });

  describe('invalid json_path handling', () => {
    it('treats invalid json_path expression as non-matching and continues', () => {
      const input: EvaluateInput = {
        payload: { type: 'test' },
        headers: { 'X-Type': 'a' },
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'json_path',
          matchKey: '$[invalid\u0000path',
          matchValue: 'x',
          destinationUrl: '/invalid-path',
        }),
        rule({
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'a',
          destinationUrl: '/fallback',
        }),
      ];

      const result = service.evaluate(input, rules, '/default');

      expect(result).toBe('/fallback');
    });

    it('treats non-existent json path as non-matching', () => {
      const input: EvaluateInput = {
        payload: { foo: 'bar' },
        headers: null,
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'json_path',
          matchKey: '$.nonexistent.path',
          matchValue: 'bar',
          destinationUrl: '/no-match',
        }),
      ];

      const result = service.evaluate(input, rules, '/default');

      expect(result).toBe('/default');
    });
  });

  describe('fallthrough to default', () => {
    it('returns defaultUrl when no rules match', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: { 'X-Event-Type': 'unknown' },
        sourceIp: '10.0.0.1',
      };
      const rules: HookMateRoutingRule[] = [
        rule({
          matchType: 'header',
          matchKey: 'X-Type',
          matchValue: 'a',
          destinationUrl: '/rule1',
        }),
        rule({
          matchType: 'json_path',
          matchKey: '$.type',
          matchValue: 'x',
          destinationUrl: '/rule2',
        }),
        rule({ matchType: 'source_ip', matchValue: '192.168.1.1', destinationUrl: '/rule3' }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });

    it('returns defaultUrl when rules array is empty', () => {
      const input: EvaluateInput = { payload: {}, headers: {}, sourceIp: null };

      const result = service.evaluate(input, [], 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });

    it('returns defaultUrl when rule has null destinationUrl and match fails', () => {
      const input: EvaluateInput = { payload: {}, headers: {}, sourceIp: null };
      const rules: HookMateRoutingRule[] = [
        rule({ matchType: 'header', matchKey: 'X', matchValue: 'y', destinationUrl: null }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });
  });

  describe('rule with null destinationUrl on match', () => {
    it('returns defaultUrl when rule matches but destinationUrl is null', () => {
      const input: EvaluateInput = {
        payload: {},
        headers: { 'X-Type': 'a' },
        sourceIp: null,
      };
      const rules: HookMateRoutingRule[] = [
        rule({ matchType: 'header', matchKey: 'X-Type', matchValue: 'a', destinationUrl: null }),
      ];

      const result = service.evaluate(input, rules, 'https://default.example.com/hook');

      expect(result).toBe('https://default.example.com/hook');
    });
  });
});
