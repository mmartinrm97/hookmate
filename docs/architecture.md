# Architecture

## System Overview

HookMate is a production-grade webhook automation platform with event-driven architecture.

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Sender    │────▶│  API Gateway    │────▶│  Ingestion   │
│  (GitHub,   │     │  (HTTP API)     │     │   Lambda     │
│   Stripe,   │     └─────────────────┘     └──────┬───────┘
│   custom)   │                                    │
└─────────────┘                          ┌─────────▼─────────┐
                                         │  PostgreSQL       │
                                         │  (events table)   │
                                         └─────────┬─────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │  SQS Queue        │
                                         │  (ingestion)      │
                                         └─────────┬─────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
          ┌─────────▼─────────┐          ┌────────▼─────────┐          ┌─────────▼─────────┐
          │  Processor        │          │  DLQ Handler     │          │  AI Background    │
          │  Lambda           │          │  Lambda          │          │  Lambda           │
          │                   │          │                  │          │  (every 30min)    │
          └─────────┬─────────┘          └────────┬─────────┘          └─────────┬─────────┘
                    │                              │                              │
          ┌─────────▼─────────┐          ┌────────▼─────────┐          ┌─────────▼─────────┐
          │  HTTP Delivery    │          │  dlq_events      │          │  ai_summaries     │
          │  + BullMQ retry   │          │  + SNS alarm     │          │  + classification │
          └───────────────────┘          └──────────────────┘          └───────────────────┘
```

## Component Responsibilities

### Ingestion Layer

**IngestionController** (`apps/api/src/ingestion/`)
- Registers raw Fastify route at `/webhooks/:endpointId`
- Captures raw body via `preParsing` hook for HMAC verification
- Delegates to `IngestionService` for processing
- Returns `202 Accepted` immediately

**IngestionService**
- Validates endpoint exists and is active
- Verifies HMAC signature (if provided)
- Writes event to PostgreSQL with status `received`
- Publishes message to SQS ingestion queue
- Returns `{ event_id, trace_id, received_at }`

### Processing Layer

**SqsConsumerService** (`apps/api/src/processor/`)
- Polls SQS ingestion queue (dev mode) or receives Lambda events (prod)
- Deserializes `IngestionMessage` payload
- Delegates to `ProcessorService` for each message

**ProcessorService**
- Fetches routing rules for the endpoint
- Evaluates rules in priority order (header, json_path, source_ip)
- Attempts HTTP delivery with timeout (10s)
- Records delivery attempt in `delivery_attempts` table
- On failure: schedules BullMQ retry with exponential backoff
- After max retries: promotes to DLQ

**DeliveryService**
- Makes HTTP POST to destination URL
- Handles timeouts, redirects, error responses
- Returns delivery result with status code and response body

### Dead Letter Queue

**DlqPromoterService** (`apps/api/src/dlq-events/`)
- Triggered when event exceeds max retries
- Writes full event context to `dlq_events` table
- Checks DLQ depth against endpoint threshold
- Publishes SNS notification if threshold exceeded

**DlqAlertService**
- Publishes to SNS topic `SNS_ALARM_TOPIC_ARN`
- Message includes endpoint ID, DLQ depth, threshold
- Used for CloudWatch alarms and operator notifications

### AI Background

**AiSummaryService** (`apps/api/src/ai-summaries/`)
- Runs every 30 minutes via BullMQ repeatable job
- Queries events per endpoint for last 24 hours
- Calls OpenAI for summary generation (gpt-4o-mini)
- Calls OpenAI for batch classification
- Upserts `ai_summaries` table
- Updates `events.category` for each classified event
- Global try/catch: failures logged only, never propagate

### Management API

**EndpointsModule** — CRUD for webhook endpoints
**EventsModule** — Filtered list, detail, delivery attempts
**DlqEventsModule** — DLQ list, retry, retry-all, purge
**RoutingRulesModule** — CRUD per endpoint
**AiSummariesModule** — List summaries, on-demand generate
**MetricsModule** — System-wide and per-endpoint metrics

### Infrastructure

**CDK Stacks** (`infrastructure/lib/`)
- `DatabaseStack` — RDS PostgreSQL, VPC, security groups
- `CacheStack` — ElastiCache Redis
- `QueueStack` — SQS ingestion queue + DLQ
- `ComputeStack` — 4 Lambda functions with IAM roles
- `ApiStack` — HTTP API Gateway + routes + CORS
- `SchedulerStack` — EventBridge for AI Lambda
- `MonitoringStack` — CloudWatch dashboard + alarms + SNS
- `FrontendStack` — S3 + CloudFront for dashboard

**Terraform Mirror** (`terraform/`)
- Equivalent infrastructure in Terraform
- 9 modules matching CDK stacks
- `COMPARISON.md` with CDK vs Terraform analysis

## Data Flow

### Happy Path

1. Sender POSTs to `/webhooks/{endpointId}`
2. API validates endpoint, verifies HMAC, writes `events` row (status: `received`)
3. API publishes SQS message `{ event_id, endpoint_id }`
4. API returns `202 { event_id, trace_id }`
5. SQS triggers Processor Lambda
6. Processor evaluates routing rules, POSTs to destination
7. On 2xx: updates `events.status = 'delivered'`
8. On non-2xx: BullMQ schedules retry with backoff

### Retry Path

1. Delivery fails (non-2xx, timeout, network error)
2. BullMQ schedules retry: `5s × 2^attempt` (max 1h)
3. Retry succeeds → update status to `delivered`
4. Retry fails after `max_attempts` → promote to DLQ

### DLQ Path

1. Event exceeds max retries
2. `DlqPromoterService` writes `dlq_events` row
3. Check: `dlq_depth > endpoint.dlqThreshold`?
4. If yes: publish SNS notification
5. CloudWatch alarm triggers if DLQ depth threshold exceeded

### AI Path

1. EventBridge triggers every 30 minutes
2. AI Lambda queries events per endpoint (last 24h)
3. OpenAI generates summary + classifies events
4. Upsert `ai_summaries`, update `events.category`
5. Failures logged only, never abort the job

## Security

- **API Key Auth**: Global `ApiKeyGuard` with `@Public()` opt-out
- **HMAC Verification**: `timingSafeEqual` for signature validation
- **IAM Least Privilege**: Each Lambda has minimal required permissions
- **VPC Isolation**: RDS and ElastiCache in private subnets only
- **Secrets Manager**: Database credentials auto-generated by CDK

## Observability

- **OpenTelemetry**: Spans for `hookmate.event.ingest`, `hookmate.event.process`, `hookmate.delivery.attempt`
- **AWS X-Ray**: Distributed tracing across Lambda functions
- **CloudWatch**: Custom dashboard with 5 alarms
  - DLQ depth threshold
  - Error rate > 5%
  - Latency p99 > 2s
  - Lambda errors
  - Database connections

## Deployment

- **CI/CD**: GitHub Actions — lint → test → CDK synth → CDK deploy
- **CDK Deploy**: `cdk deploy --all` (main branch only)
- **Terraform**: `terraform apply` (parity deployment)
- **Region**: `us-east-1` (single region, v1)
