export type HookMateMatchType = 'header' | 'json_path' | 'source_ip';

export type HookMateDestinationType = 'http' | 'slack' | 'discord' | 'discard';

export interface CreateHookMateRoutingRuleInput {
  priority: number;
  matchType: HookMateMatchType;
  matchKey?: string | null;
  matchValue?: string | null;
  destinationType?: HookMateDestinationType | null;
  destinationUrl?: string | null;
}

export interface HookMateRoutingRule {
  id: number;
  endpointId: string;
  priority: number;
  matchType: HookMateMatchType;
  matchKey: string | null;
  matchValue: string | null;
  destinationType: HookMateDestinationType | null;
  destinationUrl: string | null;
  createdAt: string;
}
