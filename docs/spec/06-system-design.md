# 6. System Design Document (SDD)

> [← Back to index](./README.md)

## 6.1 Architecture overview

```
Internet
    │
    ▼
API Gateway (HTTP API)
    │  POST /webhooks/{endpointId}
    ▼
Ingestion Lambda
    │  1. Validate endpoint
    │  2. Detect provider; verify HMAC signature (provider adapter)
    │  3. Persist raw event to RDS (PostgreSQL)
    │  4. Publish to SQS ingestion queue
    │  5. Return 202 Accepted
    ▼
SQS Ingestion Queue
    │
    ▼
Processor Lambda (BullMQ consumer)
    │  1. Pull event from queue
    │  2. Check circuit breaker state in Redis
    │  3. If circuit OPEN → DLQ immediately (circuit_open)
    │  4. Evaluate routing rules
    │  5. Deliver to destination (HTTP / Slack / Discord)
    │  6. Record attempt; update circuit breaker counters
    │  7. On success: update event status to 'delivered'; close circuit if half-open
    │  8. On failure: schedule retry via BullMQ; open circuit if threshold breached
    │
    ├── On max retries exceeded ──▶ DLQ SQS Queue ──▶ DLQ Lambda ──▶ RDS dlq_events
    │
    └── SNS Topic ──▶ CloudWatch Alarm ──▶ Slack notification (threshold breach)

Background Lambda (scheduled, every 30min)
    │  1. Query events for last 24h per endpoint
    │  2. Vercel AI SDK → OpenAI gpt-4o-mini for summary + structured classification
    │  3. Store results in RDS ai_summaries

React Dashboard (S3 + CloudFront)
    │  REST API via API Gateway → NestJS Lambda
    └── WebSocket for real-time queue depth (API Gateway WebSocket API)
```

## 6.2 Component breakdown

### Ingestion Lambda

- **Runtime:** Node.js 20.x TypeScript
- **Trigger:** API Gateway HTTP API POST `/webhooks/{endpointId}`
- **Responsibilities:**
  - Look up endpoint by ID from RDS (cached in Lambda memory for 60s)
  - Auto-detect provider from headers; run the matching signature adapter
  - Write `events` row with status `received`
  - Publish message to SQS with `event_id`, `endpoint_id`, `payload` reference (S3 key for large payloads > 256KB)
  - Return `202 Accepted` with `{ event_id, trace_id }`
- **Error handling:** If RDS write fails, return `500` and do not publish to SQS (maintain durability guarantee)

### Processor Lambda (BullMQ worker)

- **Runtime:** Node.js 20.x TypeScript, triggered by SQS event source mapping
- **Responsibilities:**
  - Deserialize job from SQS message
  - **Check circuit breaker state in Redis** — if `open`, skip delivery, write to DLQ with `circuit_open` reason, update span attribute
  - If `half-open`, allow one probe attempt; update circuit state based on result
  - Load routing rules for endpoint from RDS (cached 5min)
  - Evaluate rules, select destination
  - HTTP POST to destination with original payload + `X-HookMate-Event-Id` header
  - Record attempt in `delivery_attempts` table
  - **Update circuit breaker counters in Redis** (sliding window via sorted set + TTL)
  - On success: update `events.status = 'delivered'`; if `half-open` → close circuit
  - On failure: BullMQ schedules retry with backoff; check if failure rate threshold exceeded → open circuit
  - On max attempts: write to `dlq_events`, publish SNS threshold check
- **Concurrency:** SQS event source mapping `batchSize: 10`, `concurrency: 5` per endpoint partition

### DLQ Lambda

- **Trigger:** SQS DLQ queue
- **Responsibilities:**
  - Write full DLQ record to `dlq_events` table
  - Check DLQ depth against endpoint threshold
  - If threshold exceeded, publish alarm to SNS → Slack/Discord notification

### AI Background Lambda

- **Trigger:** EventBridge Scheduler, every 30 minutes
- **Responsibilities:**
  - For each active endpoint with events in last 24h, aggregate event stats
  - Vercel AI SDK `generateText` call for summary
  - Vercel AI SDK `generateObject` call for per-event classification (structured output via Zod schema — no free-text parsing)
  - Upsert results into `ai_summaries` and update `events.category`
- **Resilience:** Entire job wrapped in try/catch; failures logged to CloudWatch, never propagate

### NestJS API Lambda

- **Runtime:** Node.js 20.x, NestJS compiled to a single Lambda handler via `@nestjs/platform-fastify` + `aws-serverless-express`
- **Responsibilities:** All dashboard REST API endpoints (see [Section 8](./08-api-reference.md))

### React Dashboard

- **Build:** Vite + React + TypeScript + TailwindCSS + shadcn/ui
- **Deploy:** S3 static hosting + CloudFront distribution
- **State management:** TanStack Query for server state, Zustand for UI state
- **Real-time:** API Gateway WebSocket for live queue depth updates

## 6.3 Data flow — happy path

```
1. Source system POSTs to /webhooks/ep_abc123
2. API Gateway routes to Ingestion Lambda
3. Lambda validates endpoint (exists, active)
4. Lambda detects provider (e.g. Stripe from X-Stripe-Signature header), verifies HMAC
5. Lambda inserts events row: { id, endpoint_id, payload, status: 'received', received_at }
6. Lambda publishes SQS message: { event_id, endpoint_id }
7. Lambda returns 202 { event_id: "evt_xyz", trace_id: "t_..." }
8. SQS triggers Processor Lambda (within ~1s)
9. Processor checks circuit state in Redis → closed, proceed
10. Processor loads routing rules, selects destination
11. Processor POSTs payload to destination URL
12. Destination responds 200
13. Processor updates events.status = 'delivered', inserts delivery_attempts row
14. Processor increments success counter in Redis circuit window
15. OpenTelemetry span closed, trace exported to X-Ray
```

## 6.4 Data flow — circuit breaker trip

```
1–10. Same as happy path
11. Processor attempts delivery; destination responds 503
12. Processor records failure in Redis sorted set (circuit window)
13. Circuit evaluates: failure_rate = failures / total in window = 80% → threshold exceeded
14. Circuit state in Redis → 'open', TTL = cooldown period (120s)
15. Subsequent events: Processor reads 'open' → skips delivery → writes dlq_events with circuit_open
16. After 120s TTL expires, Redis key deleted → state defaults to 'half-open'
17. Next event: Processor reads no key → half-open → sends one probe
18. Probe succeeds → Processor sets Redis key to 'closed'
19. Normal delivery resumes
```

## 6.5 Data flow — retry path

```
1–9. Same as above
10. Destination responds 503
11. Processor inserts delivery_attempts row: { status: 'failed', http_status: 503, latency_ms }
12. BullMQ schedules retry job with delay = 5s * (2 ^ attempt_number)
13. Attempt 1 retried after 5s
14. Attempt 2 retried after 10s
15. Attempt 3 retried after 20s
...
N. After max_attempts (default 5): event moved to DLQ
16. DLQ Lambda writes dlq_events row
17. SNS publishes to threshold alarm topic
18. CloudWatch alarm evaluates DLQ depth
19. If depth > threshold: Lambda sends Slack notification
```

## 6.6 Queue architecture

```
SQS Ingestion Queue (Standard)
  ├── Visibility timeout: 30s
  ├── Message retention: 4 days
  ├── DLQ: SQS-Ingestion-DLQ (maxReceiveCount: 3)
  └── Event source mapping → Processor Lambda

SQS DLQ (Standard)
  ├── Message retention: 14 days
  └── Event source mapping → DLQ Lambda

Redis (ElastiCache)
  └── BullMQ job queues (per-endpoint isolation)
      ├── hookmate:jobs:{endpointId}
      └── hookmate:dlq:{endpointId}
  └── Circuit breaker state (per-endpoint)
      ├── hookmate:circuit:{endpointId}:state   — 'open' | 'half-open' (absent = closed)
      └── hookmate:circuit:{endpointId}:window  — sorted set of attempt results (TTL = window duration)
```

## 6.7 Technology decisions

| Decision        | Choice                                                              | Rationale                                                                                                                              |
| --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Queue transport | SQS + BullMQ/Redis                                                  | SQS for Lambda triggering and durability; BullMQ for retry semantics, scheduling, and per-job state                                    |
| Database        | PostgreSQL (RDS)                                                    | Relational model fits events + attempts + rules; pgvector available for Phase 2                                                        |
| ORM             | **Drizzle ORM + drizzle-kit**                                       | SQL-first, no codegen step, instant TS inference, transparent migrations — TypeORM and Prisma not recommended for new projects in 2026 |
| Validation      | **Zod + nestjs-zod**                                                | Single source of truth for runtime validation + TS types; replaces class-validator + decorators                                        |
| HTTP client     | **native fetch + undici Pool**                                      | Node 20 ships fetch natively (powered by undici); zero extra dep for basic calls; undici Pool for high-throughput delivery             |
| AI SDK          | **Vercel AI SDK**                                                   | Provider-agnostic (OpenAI, Anthropic, Bedrock, Google); `generateObject` gives structured output via Zod — no brittle JSON parsing     |
| Circuit breaker | **Redis (existing ElastiCache)**                                    | Co-located with BullMQ — no extra service; Redis sorted sets + TTL handle sliding window and automatic state expiry                    |
| Sig adapters    | **Custom provider adapters** (GitHub, Stripe, Shopify)              | Real-world providers differ in header names, timestamp tolerance, encoding; adapters document these differences explicitly              |
| Cost monitoring | **Infracost** (CI)                                                  | Posts estimated monthly cost delta on every PR that touches Terraform — FDE-grade cost awareness signal                                |
| API framework   | NestJS                                                              | Existing expertise; good Lambda adapter story                                                                                          |
| Frontend        | React + Vite + shadcn/ui                                            | Existing expertise; fast build                                                                                                         |
| IaC             | CDK (primary) + Terraform (mirror)                                  | CDK for TypeScript fluency; Terraform to satisfy the job requirement                                                                   |
| Tracing         | OpenTelemetry → X-Ray                                               | No SaaS cost; X-Ray integrates with CDK alarms                                                                                         |
| AI model        | Vercel AI SDK (provider-agnostic) + gpt-4o-mini via OpenAI provider | Provider-agnostic: same code works with OpenAI, Anthropic, Bedrock — critical for FDE work where clients use different LLM providers   |
