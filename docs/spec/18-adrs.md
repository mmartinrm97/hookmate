# 18. Architecture Decision Records (ADRs)

> [← Back to index](./README.md)

## 18.1 ADRs to write

| ID  | File                                    | Decision                             |
| --- | --------------------------------------- | ------------------------------------ |
| 001 | `docs/decisions/001-sqs-plus-bullmq.md` | SQS for Lambda triggering + BullMQ for retry/scheduling |
| 002 | `docs/decisions/002-drizzle-over-typeorm.md` | Drizzle ORM instead of TypeORM or Prisma |
| 003 | `docs/decisions/003-cdk-primary-terraform-mirror.md` | CDK as primary IaC + Terraform mirror for portfolio |
| 004 | `docs/decisions/004-circuit-breaker-in-redis.md` | Circuit breaker state stored in Redis (not DB) |

## 18.2 ADR template + example

```markdown
# ADR-{NNN}: {Decision title}

**Date:** YYYY-MM-DD  
**Status:** Accepted | Superseded by ADR-XXX  
**Deciders:** Martin

## Context

[Why is this decision needed? What is the current situation or problem?]

## Decision

[What was decided? Be precise.]

## Rationale

[Why was this option chosen over the alternatives?]

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| ...         | ...          |

## Consequences

**Positive:**
- ...

**Negative / risks:**
- ...
```

### Example: ADR-001 — SQS + BullMQ

```markdown
# ADR-001: Use SQS + BullMQ for webhook event processing

**Date:** 2026-05-01  
**Status:** Accepted  
**Deciders:** Martin

## Context

Webhook events need to be reliably delivered to destination URLs with retry logic,
per-endpoint ordering, and configurable backoff. We need to choose between:
- Pure SQS consumers
- SQS + BullMQ/Redis hybrid
- EventBridge Pipes

## Decision

Use SQS Standard Queue as the Lambda trigger (event source mapping) and BullMQ
backed by Redis (ElastiCache) for retry scheduling and per-job state.

## Rationale

SQS provides durability and the Lambda event source mapping out of the box.
BullMQ provides:
- Configurable exponential backoff per job
- Per-endpoint queue isolation
- Job state tracking (active, failed, delayed)
- Dead-letter handling with rich context

Pure SQS consumers would require re-implementing retry scheduling manually.
EventBridge Pipes doesn't support the per-endpoint ordering requirement.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Pure SQS consumer | No built-in per-job backoff scheduling; would need manual retry queue management |
| EventBridge Pipes | No per-endpoint ordering; limited retry customization |
| Kinesis | Ordering guarantees but higher cost and complexity; overkill for this use case |

## Consequences

**Positive:**
- Retry logic is declarative and testable
- Per-endpoint queue isolation prevents one slow endpoint from blocking others
- BullMQ UI available for debugging in local dev

**Negative / risks:**
- ElastiCache Redis adds ~$15/mo in infrastructure cost
- Two queue systems to operate (SQS + Redis) — adds operational complexity
- BullMQ job state is ephemeral in Redis; if Redis is lost, in-flight jobs are lost
  (mitigated by SQS visibility timeout — unprocessed messages reappear after 30s)
```

## 18.3 Why ADRs matter for this portfolio

For reviewers evaluating this project as a **Forward Deployed Engineer** signal:

1. **Evidence of decision-making**: ADRs show you can articulate trade-offs, not just implement the first solution that works
2. **Institutional knowledge**: a new team member can read ADR-004 and understand why the circuit breaker is in Redis without reverse-engineering the code
3. **FDE alignment**: customer-facing engineers regularly face "why was this built this way?" questions on-site; ADRs are the answer
