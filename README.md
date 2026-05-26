# HookMate

> Webhook infrastructure that actually works — ingestion, retries, DLQ, routing, and AI summaries, all deployed on AWS via CDK.

[![CI](https://github.com/mmartinrm97/hookmate/actions/workflows/ci.yml/badge.svg)](https://github.com/mmartinrm97/hookmate/actions/workflows/ci.yml)

## Architecture Overview

```
POST /webhooks/{endpointId}
  → API Gateway → Ingestion Lambda
  → writes events row (status: received)
  → publishes SQS message { event_id, endpoint_id }
  → returns 202 { event_id, trace_id }
  → SQS triggers Processor Lambda
  → evaluates routing rules → POSTs to destination
  → updates events.status = 'delivered'
```

**Retry path:** On non-2xx, BullMQ schedules retry with exponential backoff (`5s × 2^attempt`, max 1h). After `max_attempts` (default 5) → DLQ Lambda writes `dlq_events` row → SNS alarm if threshold exceeded.

**AI background (every 30min):** EventBridge → AI Lambda aggregates last-24h events per endpoint → OpenAI for summary + per-event classification → upserts `ai_summaries`, updates `events.category`. Non-blocking — failures logged only.

### Tech Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| API Framework    | NestJS 11 + Fastify (Lambda target)           |
| Queue            | BullMQ + Redis (ElastiCache)                  |
| Database         | TypeORM + PostgreSQL 16 (RDS)                 |
| AWS SDK          | `@aws-sdk/client-sqs`, `sns`, `secrets-manager` |
| AI               | OpenAI SDK (`gpt-4o-mini`)                    |
| Dashboard        | React 19 + Vite + TanStack Query + Recharts   |
| Infrastructure   | AWS CDK v2 + Terraform mirror                 |
| CI/CD            | GitHub Actions                                |
| Testing          | Vitest (unit + integration), Supertest (e2e)  |
| Linting          | oxlint + oxfmt                                |

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local services)

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/mmartinrm97/hookmate.git
cd hookmate
pnpm install

# 2. Start local services (PostgreSQL, Redis, Floci AWS emulator)
docker-compose up -d

# 3. Create SQS queues in Floci (first time only)
# Floci auto-creates queues on startup if configured

# 4. Seed the database (optional)
pnpm --filter @hookmate/api seed

# 5. Start API in watch mode
pnpm dev

# 6. In another terminal, start dashboard
cd apps/dashboard && pnpm dev
```

### Environment Variables

Copy `.env.example` to `apps/api/.env` and configure:

```bash
# Database (matches docker-compose.yml)
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=hookmate
POSTGRES_PASSWORD=hookmate
POSTGRES_DB=hookmate

# Redis — BullMQ
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# AWS local — Floci emulator
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# API key authentication
API_KEYS=local-dev-key
```

### Development Commands

```bash
# Root workspace
pnpm dev                  # start API in watch mode
pnpm lint                 # oxlint across all packages
pnpm format               # oxfmt (fix)
pnpm format:check         # oxfmt (CI check)
pnpm test                 # all tests
pnpm build                # build all packages

# apps/api
pnpm --filter @hookmate/api seed          # seed database with test data
pnpm --filter @hookmate/api test:unit     # vitest unit tests
pnpm --filter @hookmate/api test:e2e      # vitest e2e (requires docker-compose)

# Docker
docker-compose up -d      # postgres:5433, redis:6379, floci:4566
docker-compose down       # stop all services
```

## Project Structure

```
hookmate/
├── apps/
│   ├── api/                     # @hookmate/api — NestJS API
│   └── dashboard/               # @hookmate/dashboard — React dashboard
├── packages/
│   └── shared/                  # @hookmate/shared — shared types
├── infrastructure/              # AWS CDK stacks
├── terraform/                   # Terraform mirror
├── docs/
│   └── hookmate-spec.md         # Full technical specification
└── learning/                    # Didactic notes (gitignored)
```

## Deploy to AWS

### CDK Deploy

```bash
# 1. Bootstrap CDK (first time only)
cd infrastructure
cdk bootstrap

# 2. Deploy all stacks
cdk deploy --all

# 3. Or deploy individual stacks
cdk deploy HookMateDatabaseStack
cdk deploy HookMateQueueStack
cdk deploy HookMateComputeStack
```

### Terraform Deploy

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

See `terraform/COMPARISON.md` for CDK vs Terraform analysis.

## Database Schema

Tables: `endpoints`, `events`, `delivery_attempts`, `dlq_events`, `routing_rules`, `ai_summaries`.

All primary keys are **ULIDs** (`VARCHAR(26)`).

## API Reference

- Base URL: `https://api.hookmate.dev` (dev: `http://localhost:3000`)
- Auth: `Authorization: Bearer <token>`
- Ingestion: `POST /webhooks/{endpointId}` — returns `202 Accepted`
- Management: `/api/endpoints`, `/api/events`, `/api/dlq`, `/api/metrics`
- Swagger docs: `http://localhost:3000/api/docs` (dev only)

## Testing

```bash
# All tests
pnpm test

# Unit tests only
pnpm --filter @hookmate/api test:unit

# Integration tests (requires Docker services)
pnpm --filter @hookmate/api test:e2e
```

**Floci** (`hectorvent/floci`) emulates SQS, SNS, EventBridge, Secrets Manager locally on port 4566.

## Contributing

1. Branch from `main`: `feature/your-feature-name`
2. Commit with conventional commits: `feat(api): add something`
3. Open PR to `main`
4. CI must pass before merge

## License

UNLICENSED — Portfolio project.
