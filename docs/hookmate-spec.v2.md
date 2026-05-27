# HookMate — Complete Technical Specification

> **Portfolio context:** Phase 1 of the Forward Deployed Engineer pivot roadmap.
> **Goal:** Prove production-grade event-driven cloud infrastructure skills (AWS CDK, Terraform, GitHub Actions).
> **Environment:** Windows 11 native + WSL for Unix testing. pnpm monorepo.
> **Audit note:** When development is complete, share the repository URL for a full spec-compliance audit against this document.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Purpose & Goals](#3-purpose--goals)
4. [Scope & Constraints](#4-scope--constraints)
5. [Product Requirements (PRD)](#5-product-requirements-prd)
6. [System Design Document (SDD)](#6-system-design-document-sdd)
7. [Data Models](#7-data-models)
8. [API Reference](#8-api-reference)
9. [Infrastructure (AWS CDK)](#9-infrastructure-aws-cdk)
10. [Terraform Mirror](#10-terraform-mirror)
11. [Observability](#11-observability)
12. [Security](#12-security)
13. [Testing Strategy](#13-testing-strategy)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Development Checklist](#15-development-checklist)
16. [Definition of Done](#16-definition-of-done)
17. [Cost Analysis](#17-cost-analysis)
18. [Architecture Decision Records](#18-architecture-decision-records)

---

## 1. Overview

**HookMate** is a production-grade, event-driven webhook automation platform. It ingests webhook events from any source, processes them through configurable async pipelines, handles retries with exponential backoff, routes dead-letter events to a DLQ with full context, and delivers AI-generated summaries and classifications of event activity to configured destinations (Slack, Discord, email).

**One-line pitch:** "Webhook infrastructure that actually works — ingestion, retries, DLQ, routing, and AI summaries, all deployed on AWS via CDK."

**Portfolio signals this project demonstrates:**

- Production-grade event-driven system design (not a CRUD app)
- AWS CDK fluency: SQS, SNS, EventBridge, Lambda, RDS, API Gateway, CloudWatch
- Terraform parity: same infrastructure expressed in HCL
- GitHub Actions CI/CD with CDK deploy on merge
- OpenTelemetry instrumentation end-to-end
- AI integration as a utility layer (summaries/classification), not as the product itself
- Circuit breaker pattern for resilient delivery at scale
- Multi-provider webhook signature verification (GitHub, Stripe, Shopify)
- Cost-aware infrastructure: Infracost in CI, cost analysis documented
- Live demo deployed to AWS with realistic synthetic traffic (simulated Stripe `payment.completed`, GitHub `push`, and Shopify `order.paid` events)

---

## 2. Problem Statement

Webhook consumers break in production in predictable ways:

- **Transient failures** — downstream service is temporarily unavailable; the event is lost with no retry
- **Silent DLQ rot** — failed events pile up with no context about why they failed or what the payload contained
- **No operational visibility** — teams have no dashboard showing event volume, failure rates, or latency trends
- **Manual debugging** — reproducing a failed webhook requires digging through logs across multiple systems
- **Delivery ordering** — concurrent processing of related events causes race conditions
- **Thundering herd** — a consistently failing destination keeps getting hammered with retries instead of being circuit-broken

HookMate solves these with a single platform that treats webhook delivery as a first-class infrastructure concern.

---

## 3. Purpose & Goals

### Primary goal

Build a system that a real team would actually run in production to manage their webhook infrastructure.

### Learning goals (portfolio-specific)

| Goal                            | What you learn                                                  |
| ------------------------------- | --------------------------------------------------------------- |
| AWS CDK — SQS, SNS, EventBridge | IaC for event-driven cloud architecture                         |
| Terraform parity                | Declarative infra in HCL; comparison with CDK                   |
| BullMQ at scale                 | Queue semantics, backpressure, consumer groups, concurrency     |
| GitHub Actions + CDK deploy     | Real CI/CD pipeline that deploys to AWS on push                 |
| OpenTelemetry                   | Distributed tracing across async workers                        |
| AI as a utility                 | Summaries and classification as a background job, not a chatbot |
| Circuit breaker                 | Distributed systems resilience pattern in Redis                 |
| Multi-provider signatures       | Real-world webhook contracts differ; adapters document them     |
| Infracost                       | Cost-aware IaC: every PR shows its monthly cost delta           |

### Non-goals

- This is not an iPaaS or full workflow automation platform (not Zapier)
- No visual drag-and-drop workflow builder
- No custom scripting runtime for event transformations
- No multi-tenancy in v1

---

## 4. Scope & Constraints

### In scope (v1)

- Webhook endpoint ingestion (any HTTP POST)
- Async processing pipeline with BullMQ
- Configurable retry policy (exponential backoff, max attempts)
- Dead-letter queue with full event context and failure reason
- Circuit breaker per endpoint (closed / open / half-open states in Redis)
- Event routing rules (by source, event type, payload field)
- Multi-provider HMAC signature verification (GitHub, Stripe, Shopify, generic)
- AI event summaries via Vercel AI SDK + OpenAI gpt-4o-mini (background job, not real-time)
- AI event classification (category tagging, structured output via Zod)
- Slack and Discord delivery integrations
- OpenTelemetry tracing with CloudWatch exporter
- CDK stacks for all AWS resources
- Terraform mirror of the same infrastructure
- Infracost in GitHub Actions CI (cost delta on every PR)
- GitHub Actions pipeline: lint → test → CDK synth → CDK deploy (main branch)
- React dashboard: event log, DLQ viewer, retry controls, AI summary panel, circuit state per endpoint
- Live demo deployed with realistic synthetic traffic

### Out of scope (v1)

- Multi-tenancy / per-customer isolation
- Custom event transformation scripts
- Kafka or Kinesis transport (Redis Streams + SQS only)
- Event replay from historical archive

### Constraints

- Single AWS region deployment (us-east-1)
- PostgreSQL via RDS (not DynamoDB) — relational model for event log and routing rules
- Redis via ElastiCache (not managed BullMQ service) — also used for circuit breaker state
- All Lambda functions in TypeScript (Node.js 20.x runtime)
- No third-party observability SaaS — CloudWatch + X-Ray only (cost constraint)

---

## 5. Product Requirements (PRD)

### 5.1 User stories

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

### 5.2 Functional requirements

#### Ingestion

- FR-01: Accept HTTP POST to `/webhooks/{endpointId}` with any content type
- FR-02: Validate that `endpointId` exists and is active before accepting the event
- FR-03: Respond `202 Accepted` immediately (async processing); never block on processing
- FR-04: Persist the raw event payload to PostgreSQL before acknowledging
- FR-05: Enqueue the event to BullMQ within 100ms of persistence
- FR-06: Verify optional HMAC-SHA256 signatures using provider-specific adapters (GitHub, Stripe, Shopify, generic fallback); auto-detect provider from request headers

#### Processing

- FR-07: Process events in FIFO order per endpoint (BullMQ ordered queue)
- FR-08: Deliver events to the configured destination URL via HTTP POST
- FR-09: On non-2xx response or timeout, mark the attempt as failed and schedule a retry
- FR-10: Retry with exponential backoff: `base_delay * (2 ^ attempt)`, default base 5s, max 1h
- FR-11: After max retries exhausted, move event to DLQ with full context (all attempt details)
- FR-12: Store each delivery attempt with: timestamp, HTTP status, response body (truncated to 4KB), latency_ms

#### Routing

- FR-13: Support routing rules based on: source IP, `X-Event-Type` header, or JSON path on payload
- FR-14: Rules evaluated in priority order; first match wins
- FR-15: Unmatched events fall through to the default destination for that endpoint
- FR-16: Rules can route to: HTTP endpoint, Slack webhook, Discord webhook, or discard

#### DLQ

- FR-17: DLQ events retain: original payload, all attempt records, final failure reason, endpoint config at time of failure
- FR-18: Manual retry from DLQ re-enqueues the event with a fresh attempt counter
- FR-19: DLQ purge deletes all events for an endpoint (requires confirmation)
- FR-20: DLQ threshold alert: emit CloudWatch alarm when DLQ depth > configured threshold

#### AI features

- FR-21: Every 30 minutes, run a background job that generates a natural-language summary of events received in the last 24h per endpoint (Vercel AI SDK + OpenAI `gpt-4o-mini`)
- FR-22: On event ingestion, classify the event into a category (e.g. `payment.completed`, `user.signup`, `error`) using structured output (Zod schema + AI SDK `generateObject`); store as `event.category`
- FR-23: AI features are non-blocking — if the OpenAI call fails, log the error and continue; do not fail event processing

#### Dashboard

- FR-24: Event log with filtering by endpoint, status, date range, category
- FR-25: DLQ viewer with retry and purge controls
- FR-26: AI summary panel per endpoint
- FR-27: System metrics panel: queue depth, consumer lag, error rate (last 1h / 24h)
- FR-28: Endpoint management: create, pause, resume, delete, configure retry policy

#### Circuit breaker

- FR-29: Track per-endpoint failure rate over a configurable rolling window (default: 5 minutes) stored in Redis as a sorted-set of attempt timestamps + outcomes
- FR-30: When failure rate exceeds threshold (default: 80% failures over the window), open the circuit — subsequent delivery attempts for that endpoint are skipped immediately and routed to DLQ with `failure_reason: circuit_open`
- FR-31: After cooldown period (default: 2 minutes), transition to `half-open`: allow exactly one probe delivery attempt
- FR-32: On probe success → close the circuit and resume normal delivery; on probe failure → reset cooldown and remain open
- FR-33: Expose circuit state (`closed` | `open` | `half-open`) per endpoint via the metrics API and dashboard; allow operators to manually force-close a circuit

#### Multi-provider signature verification

- FR-34: Support provider-specific signature adapters: GitHub (`X-Hub-Signature-256`, hex HMAC), Stripe (`X-Stripe-Signature`, `t=timestamp,v1=sig` format with 5-minute tolerance), Shopify (`X-Shopify-Hmac-SHA256`, base64 HMAC)
- FR-35: Auto-detect provider from incoming request headers; fall back to the generic HMAC-SHA256 adapter when no provider-specific header is found
- FR-36: Reject Stripe events where `|now - timestamp|` exceeds 300 seconds (replay attack prevention)

### 5.3 Non-functional requirements

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

---

## 6. System Design Document (SDD)

### 6.1 Architecture overview

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

### 6.2 Component breakdown

#### Ingestion Lambda

- **Runtime:** Node.js 20.x TypeScript
- **Trigger:** API Gateway HTTP API POST `/webhooks/{endpointId}`
- **Responsibilities:**
  - Look up endpoint by ID from RDS (cached in Lambda memory for 60s)
  - Auto-detect provider from headers; run the matching signature adapter
  - Write `events` row with status `received`
  - Publish message to SQS with `event_id`, `endpoint_id`, `payload` reference (S3 key for large payloads > 256KB)
  - Return `202 Accepted` with `{ event_id, trace_id }`
- **Error handling:** If RDS write fails, return `500` and do not publish to SQS (maintain durability guarantee)

#### Processor Lambda (BullMQ worker)

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

#### DLQ Lambda

- **Trigger:** SQS DLQ queue
- **Responsibilities:**
  - Write full DLQ record to `dlq_events` table
  - Check DLQ depth against endpoint threshold
  - If threshold exceeded, publish alarm to SNS → Slack/Discord notification

#### AI Background Lambda

- **Trigger:** EventBridge Scheduler, every 30 minutes
- **Responsibilities:**
  - For each active endpoint with events in last 24h, aggregate event stats
  - Vercel AI SDK `generateText` call for summary
  - Vercel AI SDK `generateObject` call for per-event classification (structured output via Zod schema — no free-text parsing)
  - Upsert results into `ai_summaries` and update `events.category`
- **Resilience:** Entire job wrapped in try/catch; failures logged to CloudWatch, never propagate

#### NestJS API Lambda

- **Runtime:** Node.js 20.x, NestJS compiled to a single Lambda handler via `@nestjs/platform-fastify` + `aws-serverless-express`
- **Responsibilities:** All dashboard REST API endpoints (see Section 8)

#### React Dashboard

- **Build:** Vite + React + TypeScript + TailwindCSS + shadcn/ui
- **Deploy:** S3 static hosting + CloudFront distribution
- **State management:** TanStack Query for server state, Zustand for UI state
- **Real-time:** API Gateway WebSocket for live queue depth updates

### 6.3 Data flow — happy path

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

### 6.4 Data flow — circuit breaker trip

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

### 6.5 Data flow — retry path

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

### 6.6 Queue architecture

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

### 6.7 Technology decisions

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

---

## 7. Data Models

### 7.1 PostgreSQL schema

```sql
-- Endpoint registry
CREATE TABLE endpoints (
  id            VARCHAR(26) PRIMARY KEY,          -- ULID
  name          VARCHAR(255) NOT NULL,
  destination_url TEXT,
  secret        VARCHAR(255),                      -- HMAC secret (stored encrypted)
  provider      VARCHAR(20) DEFAULT 'generic',     -- generic | github | stripe | shopify
  status        VARCHAR(20) DEFAULT 'active',      -- active | paused | deleted
  max_retries   INT DEFAULT 5,
  retry_base_delay_ms INT DEFAULT 5000,
  dlq_threshold INT DEFAULT 100,
  cb_failure_threshold NUMERIC(3,2) DEFAULT 0.80,  -- circuit breaker failure rate threshold
  cb_window_seconds INT DEFAULT 300,               -- circuit breaker rolling window
  cb_cooldown_seconds INT DEFAULT 120,             -- circuit breaker cooldown after trip
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Raw events
CREATE TABLE events (
  id            VARCHAR(26) PRIMARY KEY,           -- ULID
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  payload       JSONB NOT NULL,
  headers       JSONB,
  source_ip     INET,
  status        VARCHAR(20) DEFAULT 'received',    -- received | processing | delivered | failed | dead_lettered
  category      VARCHAR(100),                      -- AI-assigned classification
  trace_id      VARCHAR(64),
  received_at   TIMESTAMPTZ DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  INDEX         (endpoint_id, received_at DESC),
  INDEX         (status),
  INDEX         (category)
);

-- Delivery attempts
CREATE TABLE delivery_attempts (
  id            BIGSERIAL PRIMARY KEY,
  event_id      VARCHAR(26) NOT NULL REFERENCES events(id),
  attempt_number INT NOT NULL,
  destination_url TEXT NOT NULL,
  http_status   INT,
  response_body TEXT,                              -- truncated to 4KB
  latency_ms    INT,
  status        VARCHAR(20),                       -- success | failed | timeout | circuit_open
  attempted_at  TIMESTAMPTZ DEFAULT NOW(),
  INDEX         (event_id)
);

-- Dead-letter queue
CREATE TABLE dlq_events (
  id            VARCHAR(26) PRIMARY KEY,
  event_id      VARCHAR(26) NOT NULL REFERENCES events(id),
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  failure_reason TEXT,                             -- includes 'circuit_open' as a valid reason
  attempts_json JSONB,                             -- snapshot of all delivery_attempts
  endpoint_snapshot JSONB,                         -- endpoint config at time of failure
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  retried_at    TIMESTAMPTZ,
  INDEX         (endpoint_id, created_at DESC)
);

-- Routing rules
CREATE TABLE routing_rules (
  id            BIGSERIAL PRIMARY KEY,
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  priority      INT NOT NULL DEFAULT 0,
  match_type    VARCHAR(20) NOT NULL,              -- header | json_path | source_ip
  match_key     VARCHAR(255),                      -- e.g. 'X-Event-Type' or '$.event.type'
  match_value   VARCHAR(255),
  destination_type VARCHAR(20),                    -- http | slack | discord | discard
  destination_url TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE        (endpoint_id, priority)
);

-- AI summaries
CREATE TABLE ai_summaries (
  id            BIGSERIAL PRIMARY KEY,
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  summary_text  TEXT NOT NULL,
  event_count   INT,
  failure_count INT,
  top_categories JSONB,
  model         VARCHAR(50),
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE        (endpoint_id, period_start)
);
```

### 7.2 SQS message schema

```typescript
// Ingestion queue message body
interface IngestionMessage {
  event_id: string; // ULID
  endpoint_id: string; // ULID
  payload_ref?: string; // S3 key if payload > 256KB
  received_at: string; // ISO 8601
  trace_id: string;
}

// DLQ message body (passed by SQS after maxReceiveCount)
interface DLQMessage {
  event_id: string;
  endpoint_id: string;
  failure_reason: string;
  original_message: IngestionMessage;
}
```

### 7.3 Redis circuit breaker schema

```
hookmate:circuit:{endpointId}:state
  Type: string
  Value: 'open' | 'half-open'
  TTL: cb_cooldown_seconds (absent = closed)

hookmate:circuit:{endpointId}:window
  Type: sorted set
  Members: "{attempt_id}:{outcome}"  (outcome: 1=success, 0=failure)
  Score: Unix timestamp of attempt
  TTL: cb_window_seconds
  — ZREMRANGEBYSCORE used to evict attempts outside the rolling window before each read
```

---

## 8. API Reference

Base URL: `https://api.hookmate.dev` (or localhost:3000 in dev)

All management endpoints require `Authorization: Bearer <token>` (API key, stored in Secrets Manager).

### 8.1 Webhook ingestion

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

### 8.2 Endpoints management

```
GET    /api/endpoints               — list all endpoints
POST   /api/endpoints               — create endpoint
GET    /api/endpoints/{id}          — get endpoint details
PATCH  /api/endpoints/{id}          — update config (retry policy, destination, circuit breaker config, etc.)
DELETE /api/endpoints/{id}          — soft-delete
POST   /api/endpoints/{id}/pause    — pause processing
POST   /api/endpoints/{id}/resume   — resume processing
```

### 8.3 Events

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

### 8.4 DLQ

```
GET    /api/dlq?endpoint_id=        — list DLQ events
POST   /api/dlq/{id}/retry          — re-enqueue a DLQ event
POST   /api/dlq/retry-all?endpoint_id= — re-enqueue all DLQ events for endpoint
DELETE /api/dlq?endpoint_id=        — purge DLQ for endpoint (requires x-confirm: true header)
```

### 8.5 Routing rules

```
GET    /api/endpoints/{id}/rules    — list routing rules
POST   /api/endpoints/{id}/rules    — create routing rule
PATCH  /api/rules/{ruleId}          — update rule (priority, match, destination)
DELETE /api/rules/{ruleId}          — delete rule
```

### 8.6 AI summaries

```
GET /api/endpoints/{id}/summaries
  ?from=ISO8601
  &to=ISO8601

POST /api/endpoints/{id}/summaries/generate  — trigger on-demand summary generation
```

### 8.7 Metrics

```
GET /api/metrics/system             — queue depth, consumer lag, error rate (aggregated)
GET /api/metrics/endpoint/{id}      — per-endpoint delivery rate, p50/p95/p99 latency,
                                      failure rate, circuit breaker state + trip history
```

### 8.8 Circuit breaker

```
GET  /api/endpoints/{id}/circuit    — current state, failure rate, last trip timestamp
POST /api/endpoints/{id}/circuit/reset  — force-close the circuit (requires x-confirm: true)
```

---

## 9. Infrastructure (AWS CDK)

All CDK code lives in `infrastructure/` as a TypeScript CDK app. Use a stack-per-layer approach.

### 9.1 Stack structure

```
infrastructure/
  bin/
    app.ts                  — CDK app entry point
  lib/
    database-stack.ts       — RDS PostgreSQL + parameter group
    cache-stack.ts          — ElastiCache Redis cluster
    queue-stack.ts          — SQS queues (ingestion, DLQ)
    api-stack.ts            — API Gateway HTTP API + WebSocket API
    compute-stack.ts        — Lambda functions (all 4)
    scheduler-stack.ts      — EventBridge Scheduler for AI background job
    monitoring-stack.ts     — CloudWatch dashboards, alarms, SNS topics
    frontend-stack.ts       — S3 bucket + CloudFront distribution
    hookmate-app-stack.ts   — Top-level stack that imports all above
```

### 9.2 Key CDK constructs

```typescript
// database-stack.ts
const db = new rds.DatabaseInstance(this, 'HookMateDB', {
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  multiAz: false, // cost constraint for portfolio
  allocatedStorage: 20,
  maxAllocatedStorage: 100,
  deletionProtection: false, // set true for production
  databaseName: 'hookmate',
  credentials: rds.Credentials.fromGeneratedSecret('hookmate_admin'),
});

// queue-stack.ts
const dlq = new sqs.Queue(this, 'HookMateDLQ', {
  retentionPeriod: Duration.days(14),
  visibilityTimeout: Duration.seconds(30),
});

const ingestionQueue = new sqs.Queue(this, 'HookMateIngestionQueue', {
  visibilityTimeout: Duration.seconds(30),
  retentionPeriod: Duration.days(4),
  deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
});

// compute-stack.ts — Ingestion Lambda
const ingestionFn = new lambda.Function(this, 'IngestionFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('../dist/ingestion'),
  environment: {
    DB_SECRET_ARN: db.secret!.secretArn,
    QUEUE_URL: ingestionQueue.queueUrl,
  },
  tracing: lambda.Tracing.ACTIVE, // X-Ray
});

// IAM least-privilege
ingestionQueue.grantSendMessages(ingestionFn);
db.secret!.grantRead(ingestionFn);

// monitoring-stack.ts — DLQ alarm
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQDepthAlarm', {
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 100,
  evaluationPeriods: 1,
  alarmName: 'HookMate-DLQ-Depth',
});
dlqAlarm.addAlarmAction(new cwActions.SnsAction(alarmTopic));
```

### 9.3 VPC design

```
VPC (10.0.0.0/16)
  Public subnets (10.0.1.0/24, 10.0.2.0/24)
    └── NAT Gateway (for Lambda egress to external webhook destinations)
  Private subnets (10.0.11.0/24, 10.0.12.0/24)
    ├── RDS instance
    └── ElastiCache Redis cluster
  Lambda functions run in private subnets with access to VPC resources
  API Gateway endpoint is public (no VPC endpoint — cost constraint)
```

### 9.4 Secrets Manager

```
hookmate/db_credentials     — RDS master password (CDK-generated)
hookmate/openai_api_key     — OpenAI API key (manually set post-deploy)
hookmate/slack_webhook_url  — Slack notification webhook
hookmate/discord_webhook_url
hookmate/api_keys           — JSON array of valid API keys for management endpoints
```

---

## 10. Terraform Mirror

The `terraform/` directory contains the same infrastructure as the CDK stacks, expressed in HCL. This is a deliberate portfolio exercise — you should be able to answer "what's the difference between CDK and Terraform for the same resource?" after building both.

### 10.1 File structure

```
terraform/
  main.tf           — provider config, backend (S3 + DynamoDB state)
  variables.tf      — input variables
  outputs.tf        — resource ARNs, endpoint URLs
  modules/
    database/       — RDS instance + security group
    cache/          — ElastiCache Redis
    queues/         — SQS ingestion queue + DLQ
    lambdas/        — Lambda functions + IAM roles
    api_gateway/    — HTTP API + routes
    monitoring/     — CloudWatch alarms + SNS
    frontend/       — S3 + CloudFront
```

### 10.2 Key differences to document (required portfolio note)

Write a `terraform/COMPARISON.md` that answers:

1. How does CDK's `grantSendMessages()` translate in Terraform? (answer: explicit `aws_iam_policy` + `aws_iam_role_policy_attachment`)
2. How does CDK handle secret rotation vs Terraform? (CDK: built into `DatabaseInstance`; Terraform: separate `aws_secretsmanager_secret_rotation` resource)
3. Which is easier to refactor? (CDK wins for TypeScript teams due to constructs and sharing code; Terraform wins for multi-cloud or non-TypeScript teams)
4. State management: CDK uses CloudFormation state in S3 implicitly; Terraform requires explicit backend config
5. Type safety: CDK is fully typed; Terraform relies on runtime validation
6. Cost visibility: Terraform integrates with Infracost natively; CDK requires `cdk-infra-cost` custom tooling

---

## 11. Observability

### 11.1 OpenTelemetry instrumentation

Every Lambda function initializes the OTel SDK on cold start:

```typescript
// otel.ts — import before anything else
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';

const sdk = new NodeSDK({
  idGenerator: new AWSXRayIdGenerator(),
  textMapPropagator: new AWSXRayPropagator(),
});
sdk.start();
```

### 11.2 Required spans

| Span name                      | Attributes                                                                  |
| ------------------------------ | --------------------------------------------------------------------------- |
| `hookmate.event.ingest`        | `endpoint_id`, `event_id`, `payload_size_bytes`, `provider`                 |
| `hookmate.sig.verify`          | `provider`, `result` (valid/invalid/skipped), `latency_ms`                  |
| `hookmate.db.write`            | `table`, `operation`, `row_id`                                              |
| `hookmate.queue.publish`       | `queue_url`, `message_size_bytes`                                           |
| `hookmate.circuit.check`       | `endpoint_id`, `state`, `failure_rate`                                      |
| `hookmate.event.process`       | `event_id`, `endpoint_id`, `attempt_number`                                 |
| `hookmate.delivery.attempt`    | `destination_url`, `http_status`, `latency_ms`, `attempt_number`            |
| `hookmate.circuit.update`      | `endpoint_id`, `outcome`, `new_state`, `failure_rate`                       |
| `hookmate.dlq.write`           | `event_id`, `failure_reason`, `total_attempts`                              |
| `hookmate.ai.summarize`        | `endpoint_id`, `event_count`, `model`, `tokens_used`                        |
| `hookmate.ai.classify`         | `event_id`, `category`, `model`                                             |

### 11.3 CloudWatch dashboard (required)

The monitoring stack must deploy a CloudWatch dashboard named `HookMate-Operations` with:

- Widget: Events received per minute (metric from Ingestion Lambda invocation count)
- Widget: Delivery success rate % (delivered / (delivered + failed))
- Widget: DLQ depth over time
- Widget: P50 / P95 / P99 delivery latency (custom metric from processor Lambda)
- Widget: Lambda cold starts count
- Widget: Error rate by function
- Widget: Circuit breaker trips per endpoint (custom metric — count of state transitions to `open`)

### 11.4 Alarms (required)

| Alarm                       | Threshold       | Action       |
| --------------------------- | --------------- | ------------ |
| DLQ depth                   | > 100           | SNS → Slack  |
| Ingestion Lambda error rate | > 1% over 5min  | SNS → Slack  |
| Processor Lambda error rate | > 5% over 5min  | SNS → Slack  |
| Circuit breaker trips       | > 3 in 10min    | SNS → Slack  |
| RDS CPU                     | > 80% for 10min | SNS log only |
| Redis memory                | > 70%           | SNS log only |

---

## 12. Security

### 12.1 HMAC verification — generic

```typescript
function verifySignature(payload: Buffer, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

- Verification is optional per endpoint (endpoints without a secret skip verification)
- Use `crypto.timingSafeEqual` — never string comparison (timing attack)
- Signature checked before DB write to avoid storing invalid events

### 12.2 IAM least-privilege (CDK)

Each Lambda function has its own execution role with only the permissions it needs:

| Function   | Permissions                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Ingestion  | `sqs:SendMessage` (ingestion queue), `rds-data:*` (events table only), `secretsmanager:GetSecretValue`     |
| Processor  | `sqs:ReceiveMessage`, `sqs:DeleteMessage` (ingestion queue), `rds-data:*`, `secretsmanager:GetSecretValue` |
| DLQ Lambda | `sqs:ReceiveMessage`, `sqs:DeleteMessage` (DLQ), `rds-data:*`, `sns:Publish` (alarm topic)                 |
| AI Lambda  | `rds-data:*`, `secretsmanager:GetSecretValue` (OpenAI key)                                                 |
| API Lambda | `rds-data:*`, `secretsmanager:GetSecretValue`                                                              |

### 12.3 API key authentication

Management API endpoints use API keys stored in Secrets Manager. Middleware validates `Authorization: Bearer <key>` against the stored key list. No JWT in v1 — API keys are sufficient for a single-operator system.

### 12.4 Payload encryption at rest

RDS encryption enabled (AWS-managed KMS key). Secrets Manager values encrypted. Endpoint HMAC secrets stored encrypted (application-level AES-256 before DB write).

### 12.5 Multi-provider webhook signature adapters

Real-world webhook providers each have slightly different signature schemes. HookMate implements a provider adapter pattern: each adapter exposes a `verify(payload, headers, secret): boolean` interface.

| Provider | Detection header            | Algorithm          | Format                          | Extra constraint                    |
| -------- | --------------------------- | ------------------ | ------------------------------- | ----------------------------------- |
| GitHub   | `X-Hub-Signature-256`       | HMAC-SHA256        | `sha256=<hex>`                  | None                                |
| Stripe   | `X-Stripe-Signature`        | HMAC-SHA256        | `t=<unix>,v1=<hex>`             | Reject if `\|now - t\| > 300s`      |
| Shopify  | `X-Shopify-Hmac-SHA256`     | HMAC-SHA256        | `<base64>`                      | None                                |
| Generic  | `X-Hub-Signature-256`       | HMAC-SHA256        | `sha256=<hex>`                  | None                                |

```typescript
// packages/shared/src/webhook-providers/stripe.adapter.ts
export function verifyStripe(payload: Buffer, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const timestamp = parseInt(parts['t'], 10);
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false; // replay guard
  const signed = `${timestamp}.${payload.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(parts['v1']), Buffer.from(expected));
}
```

Provider adapters live in `packages/shared/src/webhook-providers/` and are shared across the Ingestion Lambda and unit tests.

---

## 13. Testing Strategy

### 13.1 Unit tests (Vitest)

- Ingestion Lambda: validate endpoint lookup, HMAC verification, SQS message construction
- Provider adapters: test each adapter (GitHub, Stripe, Shopify) with valid sig, invalid sig, expired timestamp (Stripe)
- Processor: routing rule evaluation logic, retry backoff calculation, DLQ promotion logic, circuit breaker state transitions
- HMAC verification function: test valid signature, invalid signature, timing safety
- Routing rule evaluator: test all match types (header, json_path, source_ip), priority ordering, fallthrough
- Circuit breaker: test closed→open trip, open→half-open transition, half-open→closed on probe success, half-open→open on probe failure
- AI classification prompt construction and Zod schema parsing

Coverage target: 80% line coverage on business logic modules (not Lambda handlers themselves)

### 13.2 Integration tests

Integration tests run against **[Floci](https://github.com/floci-io/floci)** — a free, MIT-licensed, open-source AWS local emulator. It is a drop-in replacement for LocalStack Community Edition (which was sunset in March 2026 and now requires a paid auth token). Floci starts in ~24ms, uses ~13MB idle RAM, and runs real Docker containers for Lambda, ElastiCache (Redis), and RDS (PostgreSQL) — every service HookMate needs.

#### Floci setup for local dev and CI

Add to `docker-compose.yml` alongside PostgreSQL and Redis (which Floci also provides, but you may prefer native containers for the DB in dev):

```yaml
# docker-compose.yml
services:
  floci:
    image: hectorvent/floci:latest
    ports:
      - '4566:4566'
    environment:
      - FLOCI_HOSTNAME=floci # so SQS QueueUrls resolve correctly inside compose
      - FLOCI_STORAGE_MODE=memory # reset state between test runs
    volumes:
      - ./data:/app/data

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hookmate_test
      POSTGRES_USER: hookmate
      POSTGRES_PASSWORD: hookmate
    ports:
      - '5432:5432'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
```

Point the AWS SDK at Floci in your test environment:

```typescript
// test/aws-clients.ts
import { SQSClient } from '@aws-sdk/client-sqs';
import { SNSClient } from '@aws-sdk/client-sns';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const flociEndpoint = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const flociCreds = { accessKeyId: 'test', secretAccessKey: 'test' };
const region = 'us-east-1';

export const sqs = new SQSClient({ endpoint: flociEndpoint, region, credentials: flociCreds });
export const sns = new SNSClient({ endpoint: flociEndpoint, region, credentials: flociCreds });
export const secretsManager = new SecretsManagerClient({
  endpoint: flociEndpoint,
  region,
  credentials: flociCreds,
});
```

In GitHub Actions, start Floci as a service container before the test step (see Section 13.5).

#### What to test against Floci

- **Full ingestion → processing pipeline:** create SQS queue in Floci, invoke Ingestion Lambda handler directly (not via HTTP), assert SQS message published, assert `events` row written to test PostgreSQL
- **Processor Lambda + SQS event source mapping:** enqueue a message to Floci SQS, trigger Processor Lambda handler with the SQS event payload, assert delivery attempt recorded, assert `events.status` updated
- **Retry scheduling:** configure a test destination that returns 503, run the Processor 3 times, assert `delivery_attempts` has 3 rows with correct backoff delays (±10%), assert DLQ promotion on attempt 4
- **Circuit breaker trip:** configure a test destination that always returns 503, run until failure rate > 80%, assert Redis state is `open`, assert next event is DLQ'd with `circuit_open`
- **Circuit breaker half-open probe:** with circuit in `open` state and TTL expired, run one event, assert probe attempt recorded, assert circuit closes on 200 response
- **DLQ Lambda:** publish a message to the Floci DLQ queue, invoke DLQ Lambda handler, assert `dlq_events` row written with full context snapshot
- **SNS alarm fanout:** configure Floci SNS topic + SQS subscription, trigger threshold breach, assert SNS message delivered to the subscribed SQS queue
- **Secrets Manager:** store test OpenAI key in Floci Secrets Manager, assert Lambda reads it correctly on init
- **Provider signature adapters:** invoke Ingestion Lambda with GitHub, Stripe, and Shopify signed payloads; assert each is accepted; assert tampered signatures are rejected (400)

#### Key Floci facts to know

| Property                               | Value                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Port                                   | `4566` (same as LocalStack)                                            |
| Auth                                   | None — any `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` works         |
| Lambda runtime                         | Real Docker containers (Node.js 20.x supported)                        |
| ElastiCache                            | Real Redis via Docker                                                  |
| RDS                                    | Real PostgreSQL via Docker                                             |
| SQS, SNS, EventBridge, Secrets Manager | In-process emulation                                                   |
| State between runs                     | Use `FLOCI_STORAGE_MODE=memory` to reset on restart                    |
| Multi-container hostname               | Set `FLOCI_HOSTNAME=floci` so returned SQS URLs resolve inside Compose |

### 13.3 E2E tests (Playwright)

- Dashboard: create endpoint, send test webhook via `curl`, verify event appears in log
- DLQ flow: configure endpoint with an unreachable destination, trigger event, verify DLQ entry, retry from UI
- AI summary: trigger on-demand summary generation, verify summary text appears in panel
- Circuit breaker UI: trigger enough failures to trip circuit, verify dashboard shows `open` state, verify manual reset via UI

### 13.4 Load test (k6 — optional but recommended)

```javascript
// k6 smoke test: 100 events/sec for 60 seconds
import http from 'k6/http';
export const options = { vus: 20, duration: '60s' };
export default function () {
  http.post(
    `https://api.hookmate.dev/webhooks/${ENDPOINT_ID}`,
    JSON.stringify({ event: 'test', timestamp: Date.now() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
// Assert: P99 < 200ms, 0 errors
```

### 13.5 GitHub Actions pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    services:
      floci:
        image: hectorvent/floci:latest
        ports:
          - '4566:4566'
        env:
          FLOCI_HOSTNAME: localhost
          FLOCI_STORAGE_MODE: memory
      postgres:
        image: postgres:16-alpine
        ports:
          - '5432:5432'
        env:
          POSTGRES_DB: hookmate_test
          POSTGRES_USER: hookmate
          POSTGRES_PASSWORD: hookmate
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - '6379:6379'
    env:
      AWS_ENDPOINT_URL: http://localhost:4566
      AWS_DEFAULT_REGION: us-east-1
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
      DATABASE_URL: postgresql://hookmate:hookmate@localhost:5432/hookmate_test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration # Floci (free LocalStack replacement)

  infracost:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: infracost/actions/setup@v3
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}
      - name: Generate Infracost estimate
        run: infracost breakdown --path terraform/ --format json --out-file infracost.json
      - uses: infracost/actions/comment@v3
        with:
          path: infracost.json
          behavior: update

  cdk-synth:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - run: cd infrastructure && npm run cdk synth

  deploy:
    needs: cdk-synth
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: cd infrastructure && npm run cdk deploy --require-approval never
    env:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## 14. Acceptance Criteria

Each criterion is independently verifiable. The audit will check these explicitly.

### AC-01: Ingestion returns 202 within 200ms P99

**Given** a valid endpoint exists and is active  
**When** I POST any JSON payload to `/webhooks/{endpointId}`  
**Then** I receive a `202 Accepted` response within 200ms (P99 over 100 requests)  
**And** the response body contains `event_id` and `trace_id`

### AC-02: Event persisted before 202 returned

**Given** a valid endpoint  
**When** the Ingestion Lambda returns 202  
**Then** a row exists in the `events` table with status `received` and the correct payload

### AC-03: Event delivered to destination on success

**Given** an endpoint configured with a reachable destination that returns 200  
**When** an event is ingested  
**Then** within 5 seconds, `events.status = 'delivered'`  
**And** one row exists in `delivery_attempts` with `status = 'success'`

### AC-04: Retry on destination failure

**Given** an endpoint whose destination returns 503  
**When** an event is ingested  
**Then** the Processor Lambda retries with exponential backoff (5s, 10s, 20s...)  
**And** `delivery_attempts` contains one row per attempt  
**And** retry delay between attempt N and N+1 equals `5000ms * (2 ^ N)` (±10%)

### AC-05: DLQ populated after max retries

**Given** an endpoint with `max_retries = 3` and an always-failing destination  
**When** an event is ingested  
**Then** after 3 failed attempts, a row exists in `dlq_events`  
**And** `events.status = 'dead_lettered'`  
**And** `dlq_events.attempts_json` contains all 3 attempt records

### AC-06: DLQ retry re-enqueues event

**Given** an event in the DLQ  
**When** I POST to `/api/dlq/{id}/retry`  
**Then** a new BullMQ job is enqueued for the event with a fresh attempt counter  
**And** `dlq_events.retried_at` is set

### AC-07: Routing rule directs event to correct destination

**Given** an endpoint with a routing rule: `X-Event-Type: payment.completed → Slack webhook URL`  
**When** I send an event with header `X-Event-Type: payment.completed`  
**Then** the Processor delivers to the Slack webhook, not the default destination  
**And** the delivery attempt records the Slack webhook URL as destination

### AC-08: AI summary generated for active endpoint

**Given** an endpoint with at least 1 event in the last 24h  
**When** the background Lambda runs (manually triggered or scheduled)  
**Then** a row exists in `ai_summaries` for that endpoint covering the current period  
**And** `summary_text` is a non-empty string  
**And** the dashboard AI panel displays the summary

### AC-09: AI failure does not affect event processing

**Given** the OpenAI API key is invalid or the API is unreachable  
**When** an event is ingested  
**Then** the event is still delivered to its destination normally  
**And** only a CloudWatch ERROR log is emitted for the AI failure

### AC-10: CDK synthesizes without errors

**When** I run `cdk synth` in the `infrastructure/` directory  
**Then** the CloudFormation templates are generated without errors or warnings  
**And** all 8 stacks are present in the output

### AC-11: CDK deploy succeeds in a clean AWS account

**When** I run `cdk deploy --all` targeting a fresh AWS environment  
**Then** all resources are created without manual intervention  
**And** the Ingestion Lambda URL is output to the console

### AC-12: GitHub Actions pipeline runs end-to-end

**When** I push a commit to `main`  
**Then** the pipeline runs: lint → unit tests → integration tests → CDK synth → CDK deploy  
**And** all steps pass  
**And** a successful deployment is visible in the AWS console

### AC-13: Terraform applies to a clean environment

**When** I run `terraform init && terraform apply` in the `terraform/` directory  
**Then** all resources are created without errors  
**And** outputs include the API Gateway URL

### AC-14: OpenTelemetry traces visible in X-Ray

**Given** the system is deployed  
**When** I send 10 test events  
**Then** in AWS X-Ray I can find traces with service map: `API Gateway → IngestionLambda → SQS → ProcessorLambda`  
**And** each trace contains at minimum `hookmate.event.ingest` and `hookmate.delivery.attempt` spans

### AC-15: DLQ CloudWatch alarm fires

**Given** the `DLQ-Depth` alarm is configured with threshold 100  
**When** 101 events are in the DLQ  
**Then** the CloudWatch alarm transitions to `ALARM` state  
**And** an SNS notification is published

### AC-16: Dashboard renders event log

**Given** at least 10 events have been ingested  
**When** I open the dashboard  
**Then** the event log table shows events with correct status, timestamp, and category  
**And** filtering by status and date range works correctly

### AC-17: HMAC signature validation

**Given** an endpoint with a configured secret  
**When** I POST with a valid `X-Hub-Signature-256` header  
**Then** the event is accepted (202)  
**When** I POST with an invalid signature  
**Then** the event is rejected (400) with `{ "error": "invalid_signature" }`

### AC-18: Endpoint pause stops processing

**Given** an active endpoint  
**When** I PATCH `{ "status": "paused" }`  
**Then** new events to that endpoint receive 202 (accepted for later processing)  
**And** the Processor Lambda does not deliver events for that endpoint  
**When** I POST to `/api/endpoints/{id}/resume`  
**Then** the Processor resumes delivery for queued events

### AC-19: Circuit breaker trips on sustained failures

**Given** an endpoint with default circuit breaker config (80% threshold, 5min window)  
**When** 10 consecutive delivery attempts fail  
**Then** the circuit state in Redis transitions to `open`  
**And** subsequent events are DLQ'd immediately with `failure_reason: circuit_open`  
**And** the dashboard shows the endpoint circuit as `open`

### AC-20: Circuit breaker recovers after cooldown

**Given** a circuit in `open` state with cooldown elapsed  
**When** the next event is processed (half-open probe)  
**And** the destination responds 200  
**Then** the circuit transitions to `closed`  
**And** subsequent events are delivered normally

### AC-21: Stripe signature timestamp tolerance enforced

**Given** an endpoint with provider `stripe` configured  
**When** I POST with a valid Stripe signature but a timestamp older than 300 seconds  
**Then** the event is rejected (408) with `{ "error": "timestamp_expired" }`

### AC-22: Live demo is accessible

**When** I visit the public demo URL  
**Then** the dashboard loads with pre-seeded synthetic events (Stripe, GitHub, Shopify)  
**And** the event log, DLQ viewer, and AI summary panel all display data

### AC-23: Infracost posts cost estimate on PR

**Given** a pull request that modifies any file in `terraform/`  
**When** the CI pipeline runs  
**Then** a comment appears on the PR with an estimated monthly cost breakdown  
**And** the comment updates on subsequent pushes to the same PR

---

## 15. Development Checklist

### Repository setup

- [ ] Monorepo with workspaces: `apps/api`, `apps/dashboard`, `infrastructure`, `terraform`, `packages/shared`
- [ ] Root `package.json` with workspace scripts: `dev`, `test`, `lint`, `build`
- [ ] ESLint + Prettier configured (shared config in `packages/shared`)
- [ ] Husky pre-commit hook: lint + unit tests on staged files
- [ ] `.env.example` with all required variables documented
- [ ] `docker-compose.yml` for local development: PostgreSQL, Redis, Floci (AWS emulator)

### Phase A: Database + core models

- [ ] PostgreSQL schema migrations with **Drizzle ORM + drizzle-kit** (SQL-first, no codegen step, full TS inference — do not use TypeORM or Prisma for new projects)
- [ ] `endpoints` table with all columns including circuit breaker config fields
- [ ] `events` table with all columns and indexes
- [ ] `delivery_attempts` table with `circuit_open` as valid status value
- [ ] `dlq_events` table
- [ ] `routing_rules` table
- [ ] `ai_summaries` table
- [ ] Seed script: creates 3 test endpoints (generic, Stripe, GitHub) + 50 test events in various statuses; simulates realistic synthetic traffic for live demo

### Phase B: Ingestion Lambda

- [ ] HTTP handler: validate `endpointId`, parse body, read headers
- [ ] Provider detection: inspect headers to identify GitHub / Stripe / Shopify / generic
- [ ] Provider adapters in `packages/shared/src/webhook-providers/`: `github.adapter.ts`, `stripe.adapter.ts`, `shopify.adapter.ts`, `generic.adapter.ts`
- [ ] DB write: insert into `events` with status `received`
- [ ] SQS publish: structured `IngestionMessage` payload
- [ ] Return 202 with `event_id` and `trace_id`
- [ ] OpenTelemetry: `hookmate.event.ingest` and `hookmate.sig.verify` spans
- [ ] Unit tests: valid event, invalid endpoint, bad HMAC for each provider, Stripe timestamp expiry, DB failure
- [ ] Integration test: full roundtrip with Floci

### Phase C: Processor Lambda + BullMQ

- [ ] SQS event source mapping consuming from ingestion queue
- [ ] **Circuit breaker service**: `CircuitBreakerService` backed by Redis sorted sets + TTL; exposes `check(endpointId)`, `recordSuccess(endpointId)`, `recordFailure(endpointId)`, `forceClose(endpointId)`
- [ ] Circuit state check before delivery; if `open` → DLQ with `circuit_open` reason
- [ ] Half-open probe logic: allow one attempt, update state on result
- [ ] Routing rule evaluator: header match, json_path match, source_ip match
- [ ] HTTP delivery with **native fetch** (Node 20 built-in) for standard calls; **undici Pool** for high-throughput connection reuse (timeout: 10s)
- [ ] Delivery attempt recording in `delivery_attempts`
- [ ] BullMQ retry scheduling with exponential backoff
- [ ] DLQ promotion after max retries
- [ ] OpenTelemetry: `hookmate.circuit.check`, `hookmate.event.process`, `hookmate.delivery.attempt`, `hookmate.circuit.update` spans
- [ ] Unit tests: routing rule logic, backoff calculation, DLQ promotion, circuit breaker state machine (all transitions)
- [ ] Integration test: full flow with a test HTTP server (failing + succeeding); circuit trip and recovery

### Phase D: DLQ Lambda

- [ ] Triggered by SQS DLQ queue
- [ ] Write `dlq_events` row with full context snapshot (including `circuit_open` as valid reason)
- [ ] Check depth against endpoint threshold
- [ ] Publish SNS notification if threshold exceeded
- [ ] Unit tests: threshold logic, SNS publish

### Phase E: NestJS management API

- [ ] Endpoints CRUD (`/api/endpoints`)
- [ ] Events list + detail + attempts (`/api/events`)
- [ ] DLQ endpoints: list, retry, retry-all, purge (`/api/dlq`)
- [ ] Routing rules CRUD (`/api/endpoints/{id}/rules`)
- [ ] AI summaries: list + on-demand generate (`/api/endpoints/{id}/summaries`)
- [ ] Metrics endpoint (`/api/metrics`) — system-wide + per-endpoint + circuit breaker state
- [ ] **Circuit breaker endpoints**: `GET /api/endpoints/{id}/circuit`, `POST /api/endpoints/{id}/circuit/reset`
- [ ] API key middleware
- [ ] Swagger/OpenAPI docs (NestJS `@nestjs/swagger`)
- [ ] Integration tests: each endpoint group

### Phase F: AI Background Lambda

- [ ] EventBridge Scheduler trigger (every 30min)
- [ ] Query events per endpoint for last 24h
- [ ] Vercel AI SDK `generateText` call: summary generation (OpenAI gpt-4o-mini provider — swappable to Anthropic/Bedrock)
- [ ] Vercel AI SDK `generateObject` call: batch classification with Zod schema (structured output, no JSON parsing)
- [ ] Upsert `ai_summaries`, update `events.category`
- [ ] Error handling: failure in AI call does not abort the entire job
- [ ] Unit test: prompt construction, Zod schema validation of structured output

### Phase G: CDK infrastructure

- [ ] `DatabaseStack`: RDS, VPC, security groups, secret
- [ ] `CacheStack`: ElastiCache Redis, security group
- [ ] `QueueStack`: ingestion SQS queue + DLQ, correct visibility timeout and retention
- [ ] `ComputeStack`: all 4 Lambda functions with correct IAM roles (least-privilege)
- [ ] `ApiStack`: HTTP API Gateway + routes + CORS
- [ ] `SchedulerStack`: EventBridge Scheduler for AI Lambda
- [ ] `MonitoringStack`: CloudWatch dashboard + 6 alarms (including circuit breaker trips) + SNS topic
- [ ] `FrontendStack`: S3 bucket + CloudFront distribution + OAI
- [ ] `cdk synth` produces clean output
- [ ] `cdk diff` shows no unexpected drift after deploy

### Phase H: Terraform mirror

- [ ] Provider config: AWS, region variable
- [ ] S3 backend + DynamoDB lock table configured
- [ ] `modules/database`: matches RDS CDK stack
- [ ] `modules/cache`: matches ElastiCache CDK stack
- [ ] `modules/queues`: matches SQS CDK stack
- [ ] `modules/lambdas`: all 4 functions with IAM roles
- [ ] `modules/api_gateway`: HTTP API
- [ ] `modules/monitoring`: alarms + SNS (including circuit breaker alarm)
- [ ] `modules/frontend`: S3 + CloudFront
- [ ] `terraform/COMPARISON.md` written (including Infracost vs CDK cost tooling comparison)
- [ ] `terraform plan` produces clean output

### Phase I: React dashboard

- [ ] Vite + React + TypeScript + TailwindCSS + shadcn/ui scaffold
- [ ] TanStack Query setup with API client
- [ ] Page: Endpoints list + create form
- [ ] Page: Endpoint detail — event log table, filtering, pagination
- [ ] Page: DLQ viewer — list, retry button, purge button with confirmation modal
- [ ] Component: AI summary panel — latest summary text + top categories
- [ ] Component: System metrics panel — queue depth, error rate, latency charts (**Recharts** or **Tremor** — Tremor is built on Recharts and ships dashboard components faster)
- [ ] **Component: Circuit breaker status badge** per endpoint (`closed` green / `open` red / `half-open` yellow) with manual reset button
- [ ] WebSocket connection for live queue depth
- [ ] **Live demo seed**: on first deploy, run seed script to populate realistic Stripe/GitHub/Shopify events so the dashboard is never empty for visitors
- [ ] Deploy to S3/CloudFront via GitHub Actions

### Phase J: GitHub Actions

- [ ] Workflow: lint → unit tests → integration tests (Floci service container) → CDK synth → CDK deploy (main only)
- [ ] **Infracost job**: runs on every PR that touches `terraform/`; posts cost estimate as PR comment
- [ ] Secrets configured: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY`, `INFRACOST_API_KEY`
- [ ] Branch protection: PR requires passing CI before merge
- [ ] Deploy step only runs on `main` push
- [ ] CDK diff step on PRs (comment diff output on PR)

### Phase K: Documentation

- [ ] `README.md`: architecture overview, local dev setup, deploy instructions, environment variables, **live demo URL prominently in the header**
- [ ] `terraform/COMPARISON.md`: CDK vs Terraform analysis
- [ ] `docs/architecture.md`: data flow diagrams, component responsibilities
- [ ] `docs/runbook.md`: how to handle DLQ alerts, how to drain queues, how to roll back a deploy, **how to reset a tripped circuit breaker**
- [ ] `docs/cost-analysis.md`: monthly cost breakdown by tier (see Section 17)
- [ ] `docs/decisions/`: ADR files (see Section 18)
- [ ] Swagger docs accessible at `/api/docs` in dev

---

## 16. Definition of Done

A feature is "done" when:

1. Code is merged to `main` via a PR
2. All unit and integration tests for that feature pass in CI
3. The relevant acceptance criteria (Section 14) pass against the deployed environment
4. OpenTelemetry spans for that feature are visible in X-Ray
5. No new ESLint errors introduced
6. If the feature adds a new API endpoint: Swagger docs updated
7. If the feature modifies infrastructure: `cdk diff` reviewed and approved

The project is "done" (ready for portfolio audit) when:

- All 23 acceptance criteria pass
- All 75+ checklist items are checked
- The system is deployed to AWS and reachable at a public URL
- **Live demo URL is in the README header** and the dashboard has pre-seeded synthetic traffic
- The GitHub repository is public with a complete README
- `cdk synth` and `terraform plan` both pass cleanly in CI
- The `terraform/COMPARISON.md` document is written
- The CloudWatch dashboard is deployed and shows live metrics
- `docs/cost-analysis.md` is written with real post-deploy numbers
- The 4 ADR files in `docs/decisions/` are written

---

## 17. Cost Analysis

> Write this file as `docs/cost-analysis.md` after the first real deploy. The estimates below are pre-deploy approximations based on AWS public pricing (us-east-1, May 2026). Update with real CloudWatch billing data after running for 7 days.

### 17.1 Cost drivers to understand

Before reading the numbers, know which services surprise engineers who are new to AWS:

| Surprise | Why it stings |
| --- | --- |
| **NAT Gateway** | $0.045/hour ($32/month) regardless of traffic + $0.045/GB processed. It's always on. |
| **API Gateway** | $1.00/million requests on HTTP API. Scales linearly — at 100 events/sec it's ~$260/month just for API GW. |
| **RDS** | `t3.micro` is ~$25/month even with zero queries. It's the floor cost of the relational model. |
| **ElastiCache** | `t3.micro` is ~$15/month even idle. |
| **Lambda** | Almost free at low traffic. At 100 events/sec it becomes meaningful (~$150/month). |

### 17.2 Cost by traffic tier

All estimates assume: us-east-1, on-demand pricing, no reserved instances, 730 hours/month.

| Service | Portfolio demo (idle + occasional traffic) | Low (1 event/sec) | Medium (10 events/sec) | High (100 events/sec) |
| --- | --- | --- | --- | --- |
| NAT Gateway | $32 | $32 | $35 | $50 |
| RDS t3.micro | $25 | $25 | $25 | $25 |
| ElastiCache t3.micro | $15 | $15 | $15 | $15 |
| API Gateway (HTTP) | $0 | $2.60 | $26 | $260 |
| Lambda invocations | $0 | $0.52 | $5.18 | $51.84 |
| Lambda duration | $0 | $4.33 | $43.33 | $90 |
| SQS | $0 | $1.04 | $10.36 | $103.60 |
| CloudWatch / X-Ray | $5 | $10 | $15 | $30 |
| S3 + CloudFront | $1 | $1 | $1 | $2 |
| **Total (approx.)** | **~$78/month** | **~$91/month** | **~$176/month** | **~$627/month** |

### 17.3 Cost optimization levers (not implemented in v1 — document as known tradeoffs)

| Lever | Savings | Tradeoff |
| --- | --- | --- |
| Reserved RDS (1yr) | ~40% on RDS | Upfront commitment |
| Replace NAT GW with VPC endpoints (SQS, Secrets Manager) | ~$30/month | More CDK boilerplate, no internet egress from Lambda |
| Move to API Gateway REST API with caching | Variable | More config, REST API is $3.50/million (more expensive but cacheable) |
| Lambda ARM (Graviton) | ~20% on Lambda duration | Minimal change: `runtime: NODEJS_20_X` → `architecture: ARM_64` |
| SQS batching (increase batchSize) | ~50% on SQS cost | Higher latency per-event, more complex Lambda handler |

### 17.4 Infracost integration

Every pull request that modifies `terraform/` triggers the `infracost` CI job (see Section 13.5). The PR comment shows the estimated monthly cost delta for that change. Example output:

```
💰 Monthly cost estimate for this PR: +$15.20/month

  aws_elasticache_cluster.redis: +$15.20/month
    Instance: cache.t3.micro → cache.t3.small
```

This makes cost visible at review time — before merge, not after the bill arrives.

---

## 18. Architecture Decision Records

> Each ADR lives as a standalone file in `docs/decisions/`. Format: title, status, context, decision, consequences. Keep them short — the value is the WHY, not exhaustive prose.

### 18.1 ADRs to write

| File | Decision | Status |
| --- | --- | --- |
| `001-sqs-plus-bullmq.md` | Use SQS + BullMQ/Redis instead of SQS native retry or BullMQ alone | Accepted |
| `002-drizzle-over-typeorm.md` | Use Drizzle ORM instead of TypeORM or Prisma | Accepted |
| `003-cdk-primary-terraform-mirror.md` | CDK as primary IaC; Terraform as a deliberate learning mirror | Accepted |
| `004-circuit-breaker-in-redis.md` | Store circuit breaker state in Redis (existing ElastiCache) | Accepted |

### 18.2 ADR template and example

```markdown
# ADR-001: SQS + BullMQ over SQS native retry or BullMQ alone

**Status:** Accepted
**Date:** 2026-05

## Context

HookMate needs per-event retry with exponential backoff, per-endpoint ordering,
and DLQ promotion. Three options were evaluated:
1. SQS native retry (maxReceiveCount + DLQ)
2. BullMQ/Redis alone (no SQS)
3. SQS + BullMQ/Redis combined

## Decision

Use SQS for Lambda triggering and message durability; use BullMQ for retry
scheduling, backoff state, and per-endpoint queue isolation.

## Consequences

**Good:**
- SQS guarantees at-least-once delivery and handles Lambda scaling via event source mapping.
- BullMQ gives precise backoff delays and per-job state that SQS visibility timeout
  cannot express (SQS timeout is per-message, not per-attempt).
- Redis is already present for BullMQ — circuit breaker state is free.

**Bad:**
- Two queue systems to operate. SQS maxReceiveCount is set to 3 to catch
  Lambda panics; BullMQ handles application-level retries.
- Adds ElastiCache cost (~$15/month) that a pure SQS design would avoid.
```

### 18.3 Why ADRs matter for this portfolio

A reviewer — recruiter, tech lead, or FDE — can read 4 short ADR files in 5 minutes and immediately understand:
1. That decisions were made deliberately, not by default
2. The tradeoffs you considered
3. That you know what you gave up and why

This signal is disproportionately valuable relative to the effort of writing 4 short documents.

---

_Document version: 2.0 — May 2026_
_Next project in roadmap: terminalize (Phase 1 — building in parallel)_
_Audit: share your repository URL when complete for spec-compliance review_
