# 15. Development Checklist

> [← Back to index](./README.md)

## Repository setup

- [x] pnpm workspace configured (`pnpm-workspace.yaml`)
- [x] `tsconfig.base.json` shared across all packages
- [x] ESLint / oxlint configured at root
- [x] Commitlint + Husky `commit-msg` hook
- [x] Docker Compose with postgres, redis, floci

## Phase A — Database

- [x] TypeORM entities: `Endpoint`, `Event`, `DeliveryAttempt`, `DlqEvent`, `RoutingRule`, `AiSummary`
- [x] Drizzle schema (if migrating from TypeORM)
- [x] Migrations via `drizzle-kit` or TypeORM migrations
- [x] Database seeder for local dev

## Phase B — Ingestion Lambda

- [x] Lambda handler scaffolded under `apps/api/src/lambda/ingestion.ts`
- [x] Endpoint lookup + cache (60s in-memory)
- [x] HMAC signature verification
- [x] Write `events` row
- [x] Publish to SQS
- [x] Return `202` with `event_id` + `trace_id`
- [x] Unit tests: valid, invalid sig, unknown endpoint

## Phase C — Processor Lambda

- [x] BullMQ worker consumes SQS messages
- [x] Routing rule evaluation
- [x] HTTP delivery (native fetch)
- [x] `delivery_attempts` recording
- [x] Retry scheduling (backoff calculation)
- [x] DLQ hand-off after max_attempts
- [x] Unit tests: routing, retry backoff, status transitions

## Phase D — DLQ Lambda

- [x] SQS DLQ event source mapping
- [x] Write `dlq_events` row
- [x] SNS publish on threshold breach

## Phase E — NestJS API (management endpoints)

- [x] EndpointsModule: CRUD + pause/resume
- [x] EventsModule: list, filter, detail, attempts
- [x] DlqModule: list, retry, purge
- [x] RoutingRulesModule: CRUD
- [x] MetricsModule: system + per-endpoint
- [x] Auth guard (API key from Secrets Manager)
- [x] Integration tests with Supertest + Floci

## Phase F — AI Background Lambda

- [x] EventBridge trigger every 30min
- [x] Query events for last 24h per endpoint
- [x] OpenAI chat completion for summary
- [x] Per-event classification
- [x] Upsert `ai_summaries`, update `events.category`
- [x] Error handling: try/catch, log only

## Phase G — CDK Infrastructure

- [x] NetworkStack (VPC, subnets, NAT GW)
- [x] DatabaseStack (RDS, Secrets Manager)
- [x] QueueStack (SQS, DLQ, SNS)
- [x] CacheStack (ElastiCache Redis)
- [x] LambdaStack (all Lambda functions + API GW)
- [x] SchedulerStack (EventBridge)
- [x] DashboardStack (S3, CloudFront)
- [x] ObservabilityStack (CloudWatch, alarms)
- [x] `cdk synth` runs clean

## Phase H — Terraform

- [x] All modules: network, database, queue, cache, lambda
- [x] S3 backend + DynamoDB locking
- [x] `terraform plan` runs clean
- [x] `terraform/COMPARISON.md` written

## Phase I — React Dashboard

- [x] Vite + React + TS + TailwindCSS + shadcn/ui scaffolded
- [x] TanStack Query setup
- [x] Zustand store
- [x] Event log page (filter, pagination)
- [x] DLQ page (retry, purge)
- [x] Endpoint management page
- [x] AI summary panel
- [x] Metrics dashboard
- [x] WebSocket connection for live queue depth
- [x] Playwright E2E tests

## Phase J — GitHub Actions

- [x] `ci.yml`: lint → test → CDK synth → deploy (main only)
- [x] OIDC permissions or IAM key secrets configured

## Phase K — Documentation

- [x] `README.md` updated with architecture diagram and local dev steps
- [x] `docs/architecture.md` written
- [x] `docs/runbook.md` written
- [x] `terraform/COMPARISON.md` written
