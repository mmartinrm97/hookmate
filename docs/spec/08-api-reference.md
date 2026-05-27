# 8. API Reference

> [← Back to index](./README.md)

Base URL: `https://api.hookmate.dev` (or localhost:3000 in dev)

All management endpoints require `Authorization: Bearer <token>` (API key, stored in Secrets Manager).

## 8.1 Webhook ingestion

```
POST /webhooks/{endpointId}
Content-Type: application/json (or any)
X-Hub-Signature-256: sha256=<hmac>       (GitHub / generic)
X-Stripe-Signature: t=<ts>,v1=<sig>     (Stripe)
X-Shopify-Hmac-SHA256: <base64-hmac>    (Shopify)

Body: any JSON payload

Response 202:
{
  "event_id": "01HX...",
  "trace_id": "t_...",
  "received_at": "2026-05-20T12:00:00Z"
}

Response 404: endpoint not found
Response 400: invalid signature
Response 408: Stripe timestamp tolerance exceeded
Response 503: persistence failure (safe to retry)
```

## 8.2 Endpoints management

```
GET    /api/endpoints               — list all endpoints
POST   /api/endpoints               — create endpoint
GET    /api/endpoints/{id}          — get endpoint details
PATCH  /api/endpoints/{id}          — update config (retry policy, destination, circuit breaker config, etc.)
DELETE /api/endpoints/{id}          — soft-delete
POST   /api/endpoints/{id}/pause    — pause processing
POST   /api/endpoints/{id}/resume   — resume processing
```

## 8.3 Events

```
GET /api/events
  ?endpoint_id=
  &status=received|processing|delivered|failed|dead_lettered
  &category=
  &from=ISO8601
  &to=ISO8601
  &page=1
  &limit=50

GET /api/events/{id}                — full event detail including all attempts

GET /api/events/{id}/attempts       — list all delivery attempts for an event
```

## 8.4 DLQ

```
GET    /api/dlq?endpoint_id=        — list DLQ events
POST   /api/dlq/{id}/retry          — re-enqueue a DLQ event
POST   /api/dlq/retry-all?endpoint_id= — re-enqueue all DLQ events for endpoint
DELETE /api/dlq?endpoint_id=        — purge DLQ for endpoint (requires x-confirm: true header)
```

## 8.5 Routing rules

```
GET    /api/endpoints/{id}/rules    — list routing rules
POST   /api/endpoints/{id}/rules    — create routing rule
PATCH  /api/rules/{ruleId}          — update rule (priority, match, destination)
DELETE /api/rules/{ruleId}          — delete rule
```

## 8.6 AI summaries

```
GET /api/endpoints/{id}/summaries
  ?from=ISO8601
  &to=ISO8601

POST /api/endpoints/{id}/summaries/generate  — trigger on-demand summary generation
```

## 8.7 Metrics

```
GET /api/metrics/system             — queue depth, consumer lag, error rate (aggregated)
GET /api/metrics/endpoint/{id}      — per-endpoint delivery rate, p50/p95/p99 latency,
                                      failure rate, circuit breaker state + trip history
```

## 8.8 Circuit breaker

```
GET  /api/endpoints/{id}/circuit    — current state, failure rate, last trip timestamp
POST /api/endpoints/{id}/circuit/reset  — force-close the circuit (requires x-confirm: true)
```
