export type HookMateEventStatus =
  | 'received'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'dead_lettered';

export type HookMateDestinationType = 'http' | 'slack' | 'discord' | 'discard';
