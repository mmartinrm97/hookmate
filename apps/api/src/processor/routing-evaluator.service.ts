import { Injectable } from '@nestjs/common';
import type { HookMateRoutingRule } from '@hookmate/shared';
import { JSONPath } from 'jsonpath-plus';

export interface EvaluateInput {
  payload: Record<string, unknown>;
  headers: Record<string, string> | null;
  sourceIp: string | null;
}

@Injectable()
export class RoutingEvaluatorService {
  /**
   * Evaluates an event against priority-ordered routing rules.
   * Returns the first matching rule's destination URL, or defaultUrl if none match.
   */
  evaluate(input: EvaluateInput, rules: HookMateRoutingRule[], defaultUrl: string): string {
    for (const rule of rules) {
      if (this.matches(input, rule)) {
        return rule.destinationUrl ?? defaultUrl;
      }
    }

    return defaultUrl;
  }

  private matches(input: EvaluateInput, rule: HookMateRoutingRule): boolean {
    switch (rule.matchType) {
      case 'header':
        return this.matchHeader(input.headers, rule.matchKey, rule.matchValue);

      case 'json_path':
        return this.matchJsonPath(input.payload, rule.matchKey, rule.matchValue);

      case 'source_ip':
        return this.matchSourceIp(input.sourceIp, rule.matchValue);

      default:
        return false;
    }
  }

  private matchHeader(
    headers: Record<string, string> | null,
    key: string | null,
    value: string | null,
  ): boolean {
    if (!headers || !key || !value) {
      return false;
    }

    return headers[key] === value;
  }

  private matchJsonPath(
    payload: Record<string, unknown>,
    path: string | null,
    value: string | null,
  ): boolean {
    if (!path || !value) {
      return false;
    }

    try {
      const results: unknown[] = JSONPath({ path, json: payload });

      return results.some((r: unknown) => String(r) === value);
    } catch {
      return false;
    }
  }

  private matchSourceIp(sourceIp: string | null, value: string | null): boolean {
    if (!sourceIp || !value) {
      return false;
    }

    return sourceIp === value;
  }
}
