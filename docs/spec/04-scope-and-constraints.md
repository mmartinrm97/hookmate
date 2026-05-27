# 4. Scope & Constraints

> [← Back to index](./README.md)

## In scope (v1)

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

## Out of scope (v1)

- Multi-tenancy / per-customer isolation
- Custom event transformation scripts
- Kafka or Kinesis transport (Redis Streams + SQS only)
- Event replay from historical archive

## Constraints

- Single AWS region deployment (us-east-1)
- PostgreSQL via RDS (not DynamoDB) — relational model for event log and routing rules
- Redis via ElastiCache (not managed BullMQ service) — also used for circuit breaker state
- All Lambda functions in TypeScript (Node.js 20.x runtime)
- No third-party observability SaaS — CloudWatch + X-Ray only (cost constraint)
