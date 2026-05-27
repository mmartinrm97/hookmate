# 5. Product Requirements (PRD)

> [← Back to index](./README.md)

## 5.1 User stories

**As an API consumer / developer:**

- US-01: I can register a webhook endpoint URL that HookMate will forward events to
- US-02: I can see the full history of events received, including payload, status, and timestamps
- US-03: I can see which events failed and why, with the ability to retry them manually
- US-04: I can configure retry behavior (max attempts, backoff multiplier) per endpoint
- US-05: I can view AI-generated summaries of event activity over the last 24h
- US-06: I can configure routing rules so certain event types go to specific destinations
- US-07: I can receive Slack or Discord notifications when events fail or when the DLQ grows beyond a threshold
- US-08: I can see end-to-end latency metrics for event delivery
- US-13: I can see the circuit breaker state for each endpoint and manually reset it

**As an operator:**

- US-09: I can view system health (queue depth, consumer lag, error rate) in the dashboard
- US-10: I can manually drain or purge the DLQ
- US-11: I can pause processing for a specific endpoint without deleting it
- US-12: I can set a DLQ alert threshold per endpoint

## 5.2 Functional requirements

### Ingestion

- FR-01: Accept HTTP POST to `/webhooks/{endpointId}` with any content type
- FR-02: Validate that `endpointId` exists and is active before accepting the event
- FR-03: Respond `202 Accepted` immediately (async processing); never block on processing
- FR-04: Persist the raw event payload to PostgreSQL before acknowledging
- FR-05: Enqueue the event to BullMQ within 100ms of persistence
- FR-06: Verify optional HMAC-SHA256 signatures using provider-specific adapters (GitHub, Stripe, Shopify, generic fallback); auto-detect provider from request headers

### Processing

- FR-07: Process events in FIFO order per endpoint (BullMQ ordered queue)
- FR-08: Deliver events to the configured destination URL via HTTP POST
- FR-09: On non-2xx response or timeout, mark the attempt as failed and schedule a retry
- FR-10: Retry with exponential backoff: `base_delay * (2 ^ attempt)`, default base 5s, max 1h
- FR-11: After max retries exhausted, move event to DLQ with full context (all attempt details)
- FR-12: Store each delivery attempt with: timestamp, HTTP status, response body (truncated to 4KB), latency_ms

### Routing

- FR-13: Support routing rules based on: source IP, `X-Event-Type` header, or JSON path on payload
- FR-14: Rules evaluated in priority order; first match wins
- FR-15: Unmatched events fall through to the default destination for that endpoint
- FR-16: Rules can route to: HTTP endpoint, Slack webhook, Discord webhook, or discard

### DLQ

- FR-17: DLQ events retain: original payload, all attempt records, final failure reason, endpoint config at time of failure
- FR-18: Manual retry from DLQ re-enqueues the event with a fresh attempt counter
- FR-19: DLQ purge deletes all events for an endpoint (requires confirmation)
- FR-20: DLQ threshold alert: emit CloudWatch alarm when DLQ depth > configured threshold

### AI features

- FR-21: Every 30 minutes, run a background job that generates a natural-language summary of events received in the last 24h per endpoint (Vercel AI SDK + OpenAI `gpt-4o-mini`)
- FR-22: On event ingestion, classify the event into a category (e.g. `payment.completed`, `user.signup`, `error`) using structured output (Zod schema + AI SDK `generateObject`); store as `event.category`
- FR-23: AI features are non-blocking — if the OpenAI call fails, log the error and continue; do not fail event processing

### Dashboard

- FR-24: Event log with filtering by endpoint, status, date range, category
- FR-25: DLQ viewer with retry and purge controls
- FR-26: AI summary panel per endpoint
- FR-27: System metrics panel: queue depth, consumer lag, error rate (last 1h / 24h)
- FR-28: Endpoint management: create, pause, resume, delete, configure retry policy

### Circuit breaker

- FR-29: Track per-endpoint failure rate over a configurable rolling window (default: 5 minutes) stored in Redis as a sorted-set of attempt timestamps + outcomes
- FR-30: When failure rate exceeds threshold (default: 80% failures over the window), open the circuit — subsequent delivery attempts for that endpoint are skipped immediately and routed to DLQ with `failure_reason: circuit_open`
- FR-31: After cooldown period (default: 2 minutes), transition to `half-open`: allow exactly one probe delivery attempt
- FR-32: On probe success → close the circuit and resume normal delivery; on probe failure → reset cooldown and remain open
- FR-33: Expose circuit state (`closed` | `open` | `half-open`) per endpoint via the metrics API and dashboard; allow operators to manually force-close a circuit

### Multi-provider signature verification

- FR-34: Support provider-specific signature adapters: GitHub (`X-Hub-Signature-256`, hex HMAC), Stripe (`X-Stripe-Signature`, `t=timestamp,v1=sig` format with 5-minute tolerance), Shopify (`X-Shopify-Hmac-SHA256`, base64 HMAC)
- FR-35: Auto-detect provider from incoming request headers; fall back to the generic HMAC-SHA256 adapter when no provider-specific header is found
- FR-36: Reject Stripe events where `|now - timestamp|` exceeds 300 seconds (replay attack prevention)

## 5.3 Non-functional requirements

| Category              | Requirement                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| Ingestion latency     | P99 < 200ms for the `202 Accepted` response                              |
| Processing throughput | Handle 500 events/sec sustained without queue backup                     |
| Retry delivery        | First retry within 5 seconds of failure                                  |
| DLQ write             | Failed event persisted to DLQ within 500ms of final failure              |
| Dashboard load        | Initial load < 2 seconds on a cold browser                               |
| Availability          | API endpoint: 99.9% uptime (Lambda + ALB)                                |
| Durability            | Zero event loss after `202 Accepted` (event persisted before ack)        |
| Observability         | Every event has a trace ID linkable through ingestion → queue → delivery |
