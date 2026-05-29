# ADR-004: Circuit breaker state stored in Redis

**Date:** 2026-05-28  
**Status:** Accepted  
**Deciders:** Martin

## Context

Webhook delivery needs a circuit breaker pattern to prevent overwhelming
destinations that are experiencing failures. The circuit breaker state
(closed, open, half-open) and failure counters need to be stored somewhere.
Options considered:

- Redis (ElastiCache)
- PostgreSQL (same database as events)
- In-memory (per-Lambda instance)
- DynamoDB

## Decision

Store circuit breaker state in Redis using sorted sets for sliding window
failure tracking and string keys for state with TTL.

## Rationale

Redis was chosen because:

- Already available (ElastiCache for BullMQ) — no additional infrastructure
- Atomic operations (SETNX, ZADD, ZCARD) prevent race conditions
- TTL support for automatic state expiration (cooldown period)
- Sorted sets enable efficient sliding window failure rate calculation
- Sub-millisecond latency — doesn't add to delivery latency

PostgreSQL would work but adds write load to the primary database and requires
more complex queries for sliding window calculations. In-memory doesn't survive
Lambda cold starts or scale across instances. DynamoDB adds cost and latency.

## Alternatives considered

| Alternative | Why rejected                                                     |
| ----------- | ---------------------------------------------------------------- |
| PostgreSQL  | Adds write load to primary DB; complex sliding window queries    |
| In-memory   | Lost on Lambda cold start; doesn't scale across instances        |
| DynamoDB    | Higher latency; additional cost; eventual consistency concerns   |

## Consequences

**Positive:**

- No additional infrastructure cost (reuses existing ElastiCache)
- Atomic operations prevent race conditions in concurrent Lambda invocations
- Sliding window enables accurate failure rate calculation
- Fail-open on Redis errors (better to deliver than silence events)

**Negative / risks:**

- Redis failure means circuit breaker defaults to closed (fail-open)
- Sorted set members accumulate; requires periodic cleanup via ZREMRANGEBYSCORE
- State is ephemeral; Redis restart resets all circuits to closed
