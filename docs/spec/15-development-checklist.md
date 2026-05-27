# 15. Development Checklist

> [← Back to index](./README.md)

## Repository setup

- [ ] pnpm workspace configured (`pnpm-workspace.yaml`)
- [ ] `tsconfig.base.json` shared across all packages
- [ ] oxlint configured at root
- [ ] Commitlint + Husky `commit-msg` hook
- [ ] Docker Compose with postgres, redis, floci

## Phase A — Database

- [ ] Drizzle ORM schema: `endpoints`, `events`, `delivery_attempts`, `dlq_events`, `routing_rules`, `ai_summaries`
- [ ] `endpoints` table includes: `provider`, `cb_failure_threshold`, `cb_window_seconds`, `cb_cooldown_seconds`
- [ ] Drizzle migrations via `drizzle-kit generate` + `drizzle-kit migrate`
- [ ] Database seeder for local dev (includes demo data for live demo AC-22)
- [ ] Zod schemas derived from Drizzle schema (`zod.string().ulid()` pattern)

## Phase B — Ingestion Lambda

- [ ] Lambda handler scaffolded under `apps/api/src/lambda/ingestion.ts`
- [ ] Endpoint lookup + cache (60s in-memory)
- [ ] Provider adapter auto-detection (header → adapter selection)
- [ ] GitHub adapter: `X-Hub-Signature-256` hex HMAC
- [ ] Stripe adapter: `X-Stripe-Signature` t+v1 format + 300s tolerance
- [ ] Shopify adapter: `X-Shopify-Hmac-SHA256` base64 HMAC
- [ ] Generic fallback adapter
- [ ] Write `events` row
- [ ] Publish to SQS
- [ ] Return `202` with `event_id` + `trace_id`
- [ ] Unit tests: all provider adapters, stale Stripe timestamp, missing header fallback

## Phase C — Processor Lambda

- [ ] BullMQ worker consumes SQS messages
- [ ] Circuit breaker read from Redis before delivery
- [ ] If `open`: skip delivery, write to DLQ with `circuit_open`, update span
- [ ] If `half-open`: send probe, update state based on result
- [ ] Routing rule evaluation
- [ ] HTTP delivery (native fetch + undici Pool)
- [ ] `delivery_attempts` recording (includes `circuit_open` status)
- [ ] Circuit breaker counters update in Redis after each attempt
- [ ] Retry scheduling (backoff calculation)
- [ ] DLQ hand-off after max_attempts
- [ ] Unit tests: circuit state machine (all 6 transitions), routing, retry backoff

## Phase D — DLQ Lambda

- [ ] SQS DLQ event source mapping
- [ ] Write `dlq_events` row (includes `circuit_open` failure reason)
- [ ] SNS publish on threshold breach

## Phase E — NestJS API (management endpoints)

- [ ] EndpointsModule: CRUD + pause/resume + circuit breaker config in PATCH
- [ ] EventsModule: list, filter, detail, attempts
- [ ] DlqModule: list, retry, purge
- [ ] RoutingRulesModule: CRUD
- [ ] MetricsModule: system + per-endpoint + circuit state
- [ ] CircuitBreakerModule: GET state, POST reset
- [ ] All request/response DTOs validated with nestjs-zod
- [ ] Auth guard (API key from Secrets Manager)
- [ ] Integration tests with Supertest + Floci

## Phase F — AI Background Lambda

- [ ] EventBridge trigger every 30min
- [ ] Query events for last 24h per endpoint (Drizzle query)
- [ ] Vercel AI SDK `generateText` for summary
- [ ] Vercel AI SDK `generateObject` + Zod schema for per-event classification (structured output)
- [ ] Upsert `ai_summaries`, update `events.category`
- [ ] Error handling: try/catch, log only

## Phase G — CDK Infrastructure

- [ ] NetworkStack (VPC, subnets, NAT GW)
- [ ] DatabaseStack (RDS, Secrets Manager)
- [ ] QueueStack (SQS, DLQ, SNS)
- [ ] CacheStack (ElastiCache Redis)
- [ ] LambdaStack (all Lambda functions + API GW)
- [ ] SchedulerStack (EventBridge)
- [ ] DashboardStack (S3, CloudFront)
- [ ] ObservabilityStack (CloudWatch, alarms including circuit breaker trips alarm)
- [ ] `cdk synth` runs clean

## Phase H — Terraform

- [ ] All modules: network, database, queue, cache, lambda
- [ ] S3 backend + DynamoDB locking
- [ ] Infracost configuration (`.infracost/` or `infracost.yml`)
- [ ] `terraform plan` runs clean
- [ ] `terraform/COMPARISON.md` updated (includes Infracost item)

## Phase I — React Dashboard

- [ ] Vite + React + TS + TailwindCSS + shadcn/ui scaffolded
- [ ] TanStack Query setup
- [ ] Zustand store
- [ ] Event log page (filter, pagination)
- [ ] DLQ page (retry, purge)
- [ ] Endpoint management page (includes circuit breaker config section)
- [ ] Circuit breaker state panel (state badge, last trip, manual reset button)
- [ ] AI summary panel
- [ ] Metrics dashboard
- [ ] WebSocket connection for live queue depth
- [ ] Playwright E2E tests (includes circuit breaker UI test)

## Phase J — GitHub Actions

- [ ] `ci.yml`: lint → test → CDK synth → infracost → deploy (main only)
- [ ] Infracost action configured with `INFRACOST_API_KEY` secret
- [ ] OIDC permissions or IAM key secrets configured

## Phase K — Documentation

- [ ] `README.md` updated with architecture diagram, local dev steps, live demo URL
- [ ] `docs/architecture.md` written
- [ ] `docs/runbook.md` written
- [ ] `docs/cost-analysis.md` written (after first real deploy)
- [ ] `docs/decisions/001-sqs-plus-bullmq.md` written
- [ ] `docs/decisions/002-drizzle-over-typeorm.md` written
- [ ] `docs/decisions/003-cdk-primary-terraform-mirror.md` written
- [ ] `docs/decisions/004-circuit-breaker-in-redis.md` written
- [ ] `terraform/COMPARISON.md` written
- [ ] Live demo seed script seeds 50 events, 3 endpoints, 2 routing rules
