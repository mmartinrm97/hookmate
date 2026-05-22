# HookMate — Agent Context

> Full spec: [`docs/hookmate-spec.md`](docs/hookmate-spec.md)

---

## Project Overview

**HookMate** is a production-grade, event-driven webhook automation platform.

One-line pitch: _"Webhook infrastructure that actually works — ingestion, retries, DLQ, routing, and AI summaries, all deployed on AWS via CDK."_

This is a **portfolio project** demonstrating: AWS CDK (SQS, SNS, EventBridge, Lambda, RDS, API Gateway, CloudWatch), Terraform parity, GitHub Actions CI/CD, OpenTelemetry instrumentation, and AI as a utility layer.

---

## Monorepo Structure

```
hookmate/                        ← pnpm workspace root
├── apps/
│   ├── api/                     ← @hookmate/api — NestJS 11 + Fastify (Lambda target)
│   └── dashboard/               ← @hookmate/dashboard — React 19 + Vite 8
├── packages/
│   └── shared/                  ← @hookmate/shared — shared types and utilities
├── infrastructure/              ← @hookmate/infrastructure — AWS CDK stacks
├── terraform/                   ← Terraform mirror of CDK infrastructure
└── docs/
    └── hookmate-spec.md         ← Full technical specification (source of truth)
```

---

## Barrel File Rule

Every `index.ts` in this repository is a **barrel file only**.

### Mandatory rule

- Use any `index.ts` only to `export` / `re-export` from other files.
- **Do not add** interfaces, types, enums, consts, functions, classes, schemas, or business logic directly inside `index.ts`.
- Create dedicated files first (for example `endpoint.types.ts`, `event.types.ts`, `constants.ts`, etc.), then re-export them from `index.ts`.

### Forbidden in any `index.ts`

- inline interfaces
- inline types
- inline enums
- inline constants
- inline functions
- inline classes
- inline implementations of any kind

---

## Git Workflow Conventions

These rules are **mandatory** for every human or agent working in this repository.

### Branch naming

- Do **not** use the `codex/` or another AI-related prefix in this repository.
- Start every non-trivial change from `main`.
- Use **one branch per feature, fix, refactor, infra slice, or docs slice**.
- Open a PR back into `main` when the slice is ready.
- Do **not** develop long-lived work directly on `main`.

### Branch format

Use this format:

```text
<type>/<short-kebab-description>
```

If the project later adopts issue IDs, this format is also allowed:

```text
<type>/<ticket-id>-<short-kebab-description>
```

### Allowed branch types

- `feature/`
- `bugfix/`
- `hotfix/`
- `refactor/`
- `chore/`
- `docs/`
- `test/`
- `ci/`
- `build/`
- `infra/`
- `release/`

### Branch naming rules

- Use lowercase only.
- Use kebab-case for the descriptive part.
- Use `/` only to separate branch type from the description.
- Keep names short, explicit, and searchable.
- Do **not** use spaces.
- Do **not** use uppercase.
- Do **not** use camelCase or PascalCase.
- Do **not** use vague names like `fix/stuff`, `feature/new`, or `chore/update`.

### Good branch names

- `feature/endpoints-persistence`
- `feature/webhook-ingestion`
- `bugfix/hmac-signature-validation`
- `refactor/api-bootstrap-versioning`
- `infra/cdk-core-stacks`
- `docs/runbook-local-development`

### Bad branch names

- `codex/feature-endpoints`
- `feature/new`
- `fixThings`
- `my-branch`
- `test123`
- `hice-un-arreglo`

### Commit messages

This repository uses **Conventional Commits**. Freeform commit messages are forbidden.

Use this format:

```text
<type>[optional scope]: <description>
```

Examples:

- `feat(api): add endpoints persistence`
- `fix(api): validate webhook signature header`
- `refactor(shared): split endpoint contracts`
- `docs(root): document branch naming convention`

### Allowed commit types

- `build`
- `chore`
- `ci`
- `docs`
- `feat`
- `fix`
- `perf`
- `refactor`
- `revert`
- `style`
- `test`

### Commit message rules

- Write the description in English.
- Use lowercase for `type` and `scope`.
- Keep the subject concise and imperative.
- Do **not** end the subject with a period.
- Do **not** write vague commit messages.
- Do **not** write narrative messages like `hice esto para solucionar...`.
- Use `!` or `BREAKING CHANGE:` when the change is breaking.

### Forbidden commit messages

- `hice esto para solucionar tal XXXXX`
- `misc changes`
- `fix stuff`
- `update files`
- `changes`

### Enforcement

- Commit message validation is enforced through `.husky/commit-msg`.
- The source of truth for allowed commit types is `commitlint.config.ts`.
- If a commit does not satisfy Conventional Commits, it must be rewritten before it lands.

---

## Tech Stack

### `apps/api` — NestJS API

| Layer            | Technology                                            |
| ---------------- | ----------------------------------------------------- |
| Framework        | NestJS 11 + `@nestjs/platform-fastify`                |
| Runtime target   | AWS Lambda via `aws-serverless-express`               |
| Queue            | BullMQ + `@nestjs/bull` + Redis (ElastiCache)         |
| Database ORM     | TypeORM 0.3 + PostgreSQL (RDS)                        |
| AWS SDK          | `@aws-sdk/client-sqs`, `sns`, `secrets-manager`       |
| AI               | OpenAI SDK (`gpt-4o-mini` for summaries/classify)     |
| IDs              | ULID (`ulid` package)                                 |
| Testing          | Vitest 2 (unit + integration), Supertest (e2e)        |
| Linter/formatter | oxlint + oxlint-tsgolint (type-aware) + oxfmt         |
| TypeScript       | 6.0, `module: NodeNext`, `moduleResolution: NodeNext` |

### `apps/dashboard` — React Dashboard

| Layer        | Technology                  |
| ------------ | --------------------------- |
| Framework    | React 19 + Vite 8           |
| Styling      | Tailwind CSS v4 + shadcn/ui |
| Server state | TanStack Query v5           |
| UI state     | Zustand v5                  |
| Charts       | Recharts v3                 |
| Real-time    | API Gateway WebSocket       |
| TypeScript   | 6.0                         |

### Infrastructure

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| IaC           | AWS CDK v2 (TypeScript) + Terraform mirror              |
| Region        | `us-east-1` (single region, v1)                         |
| Queue         | SQS Standard (ingestion queue + DLQ)                    |
| Database      | RDS PostgreSQL 16                                       |
| Cache/Queue   | ElastiCache Redis 7                                     |
| Lambdas       | Node.js 20.x — Ingestion, Processor, DLQ, AI Background |
| Delivery      | S3 + CloudFront (dashboard), API Gateway (API)          |
| Observability | OpenTelemetry → AWS X-Ray + CloudWatch                  |
| CI/CD         | GitHub Actions: lint → test → CDK synth → CDK deploy    |

---

## Architecture — Key Flows

**Ingestion (happy path):**

```
POST /webhooks/{endpointId}
  → API Gateway → Ingestion Lambda
  → writes `events` row (status: received)
  → publishes SQS message { event_id, endpoint_id }
  → returns 202 { event_id, trace_id }
  → SQS triggers Processor Lambda
  → evaluates routing rules → POSTs to destination
  → updates events.status = 'delivered'
```

**Retry path:** On non-2xx, BullMQ schedules retry with exponential backoff (`5s × 2^attempt`, max 1h). After `max_attempts` (default 5) → DLQ Lambda writes `dlq_events` row → SNS alarm if threshold exceeded.

**AI background (every 30min):** EventBridge → AI Lambda aggregates last-24h events per endpoint → OpenAI for summary + per-event classification → upserts `ai_summaries`, updates `events.category`. Non-blocking — failures logged only.

---

## Database Schema (PostgreSQL)

Tables: `endpoints`, `events`, `delivery_attempts`, `dlq_events`, `routing_rules`, `ai_summaries`.

Key types:

- All primary keys are **ULIDs** (`VARCHAR(26)`)
- `events.status`: `received | processing | delivered | failed | dead_lettered`
- `routing_rules.match_type`: `header | json_path | source_ip`
- `routing_rules.destination_type`: `http | slack | discord | discard`

Full schema in [`docs/hookmate-spec.md`](docs/hookmate-spec.md#7-data-models).

---

## API Conventions

- Base URL: `https://api.hookmate.dev` (dev: `http://localhost:3000`)
- Auth: `Authorization: Bearer <token>` (API key via Secrets Manager)
- Ingestion endpoint: `POST /webhooks/{endpointId}` — returns `202 Accepted` always
- All IDs are ULIDs
- Error format: `{ statusCode, message, error }`

---

## Testing Strategy

| Layer       | Tool       | Location                                                      |
| ----------- | ---------- | ------------------------------------------------------------- |
| Unit        | Vitest 2   | `apps/api/src/**/*.spec.ts`                                   |
| Integration | Vitest 2   | `apps/api/test/**/*.spec.ts` + Floci (LocalStack replacement) |
| E2E         | Playwright | `apps/dashboard/e2e/`                                         |
| Load        | k6         | `apps/api/test/load/`                                         |

**Floci** (`hectorvent/floci`) emulates SQS, SNS, EventBridge, Secrets Manager locally on port 4566. Set `AWS_ENDPOINT_URL=http://localhost:4566` in tests.

---

## Development Commands

```bash
# Root workspace
pnpm dev                  # start API in watch mode
pnpm lint                 # oxlint across all packages
pnpm format               # oxfmt (fix)
pnpm format:check         # oxfmt (CI check)
pnpm test                 # all tests
pnpm build                # build all packages

# apps/api
pnpm test:unit            # vitest unit tests
pnpm test:e2e             # vitest e2e (requires docker-compose services up)

# Docker (local dev services)
docker-compose up -d      # postgres:5432, redis:6379, floci:4566
```

---

## Key Constraints & Decisions

- **No multi-tenancy in v1** — single tenant, single AWS region
- **PostgreSQL over DynamoDB** — relational model for event log and routing rules (queryable by status, category, date range)
- **BullMQ over raw SQS consumers** — per-endpoint FIFO ordering, job scheduling for retries
- **NestJS compiled to Lambda** — single handler via `aws-serverless-express` (not microservices)
- **AI is non-blocking** — OpenAI failures never fail event processing
- **No third-party observability** — CloudWatch + X-Ray only (cost constraint)

---

<!-- CODEGRAPH_START -->

## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question                                      | Tool                |
| --------------------------------------------- | ------------------- |
| "Where is X defined?" / "Find symbol named X" | `codegraph_search`  |
| "What calls function Y?"                      | `codegraph_callers` |
| "What does Y call?"                           | `codegraph_callees` |
| "What would break if I changed Z?"            | `codegraph_impact`  |
| "Show me Y's signature / source / docstring"  | `codegraph_node`    |
| "Give me focused context for a task/area"     | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/"                | `codegraph_files`   |
| "Is the index healthy?"                       | `codegraph_status`  |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture / trace questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: _"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"_

<!-- CODEGRAPH_END -->
