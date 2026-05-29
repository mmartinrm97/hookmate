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

| Alternative       | Why rejected                                                                     |
| ----------------- | -------------------------------------------------------------------------------- |
| Pure SQS consumer | No built-in per-job backoff scheduling; would need manual retry queue management |
| EventBridge Pipes | No per-endpoint ordering; limited retry customization                            |
| Kinesis           | Ordering guarantees but higher cost and complexity; overkill for this use case   |

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
