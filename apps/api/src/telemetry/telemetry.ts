import { trace, type Tracer } from '@opentelemetry/api';

const TRACER_NAME = 'hookmate';

let tracer: Tracer | null = null;

/**
 * Returns the shared OpenTelemetry tracer for HookMate.
 * Lazily initialized so it works in both Lambda and local dev environments.
 */
export function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer(TRACER_NAME);
  }
  return tracer;
}

/**
 * Attribute keys used across all HookMate spans.
 */
export const OtelAttributes = {
  ENDPOINT_ID: 'hookmate.endpoint_id',
  EVENT_ID: 'hookmate.event_id',
  EVENT_STATUS: 'hookmate.event_status',
  TRACE_ID: 'hookmate.trace_id',
  DELIVERY_URL: 'hookmate.delivery_url',
  DELIVERY_STATUS: 'hookmate.delivery_status',
  ATTEMPT_NUMBER: 'hookmate.attempt_number',
  MATCH_TYPE: 'hookmate.match_type',
  RULE_ID: 'hookmate.rule_id',
} as const;
