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
    │  2. Persist raw event to RDS (PostgreSQL)
    │  3. Publish to SQS ingestion queue
    │  4. Return 202 Accepted
    ▼
SQS Ingestion Queue
    │
    ▼
Processor Lambda (BullMQ consumer)
    │  1. Pull event from queue
    │  2. Evaluate routing rules
    │  3. Deliver to destination (HTTP / Slack / Discord)
    │  4. On success: update event status to 'delivered'
    │  5. On failure: schedule retry via BullMQ
    │
    ├── On max retries exceeded ──▶ DLQ SQS Queue ──▶ DLQ Lambda ──▶ RDS dlq_events
    │
    └── SNS Topic ──▶ CloudWatch Alarm ──▶ Slack notification (threshold breach)

Background Lambda (scheduled, every 30min)
    │  1. Query events for last 24h per endpoint
    │  2. Call OpenAI gpt-4o-mini for summary + classification
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
  - Optionally verify HMAC-SHA256 signature
  - Write `events` row with status `received`
  - Publish message to SQS with `event_id`, `endpoint_id`, `payload` reference (S3 key for large payloads > 256KB)
  - Return `202 Accepted` with `{ event_id, trace_id }`
- **Error handling:** If RDS write fails, return `500` and do not publish to SQS (maintain durability guarantee)

### Processor Lambda (BullMQ worker)

- **Runtime:** Node.js 20.x TypeScript, triggered by SQS event source mapping
- **Responsibilities:**
  - Deserialize job from SQS message
  - Load routing rules for endpoint from RDS (cached 5min)
  - Evaluate rules, select destination
  - HTTP POST to destination with original payload + `X-HookMate-Event-Id` header
  - Record attempt in `delivery_attempts` table
  - On success: update `events.status = 'delivered'`
  - On failure: BullMQ schedules retry with backoff; update attempt record
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
  - Call OpenAI chat completion for summary
  - Call OpenAI chat completion for per-event classification (batched)
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
4. Lambda inserts events row: { id, endpoint_id, payload, status: 'received', received_at }
5. Lambda publishes SQS message: { event_id, endpoint_id }
6. Lambda returns 202 { event_id: "evt_xyz", trace_id: "t_..." }
7. SQS triggers Processor Lambda (within ~1s)
8. Processor loads routing rules, selects destination
9. Processor POSTs payload to destination URL
10. Destination responds 200
11. Processor updates events.status = 'delivered', inserts delivery_attempts row
12. OpenTelemetry span closed, trace exported to X-Ray
```

## 6.4 Data flow — retry path

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

## 6.5 Queue architecture

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
```

## 6.6 Technology decisions

| Decision        | Choice                             | Rationale                                                                                           |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Queue transport | SQS + BullMQ/Redis                 | SQS for Lambda triggering and durability; BullMQ for retry semantics, scheduling, and per-job state |
| Database        | PostgreSQL (RDS)                   | Relational model fits events + attempts + rules; pgvector available for Phase 2                     |
| API framework   | NestJS                             | Existing expertise; good Lambda adapter story                                                       |
| Frontend        | React + Vite + shadcn/ui           | Existing expertise; fast build                                                                      |
| IaC             | CDK (primary) + Terraform (mirror) | CDK for TypeScript fluency; Terraform to satisfy the job requirement                                |
| Tracing         | OpenTelemetry → X-Ray              | No SaaS cost; X-Ray integrates with CDK alarms                                                      |
| AI              | OpenAI gpt-4o-mini                 | Cost-efficient for summaries; easily swappable                                                      |
