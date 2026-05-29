# ADR-002: Use TypeORM for database access

**Date:** 2026-05-01  
**Status:** Accepted  
**Deciders:** Martin

## Context

The application needs an ORM to interact with PostgreSQL for managing endpoints,
events, delivery attempts, DLQ events, routing rules, and AI summaries. Options
considered:

- TypeORM
- Drizzle ORM
- Prisma
- Raw SQL with a query builder

## Decision

Use TypeORM 0.3 with PostgreSQL for all database operations.

## Rationale

TypeORM was chosen because:

- Mature ecosystem with extensive NestJS integration (`@nestjs/typeorm`)
- Active record and data mapper patterns both supported
- Entity decorators align well with NestJS dependency injection
- Migration support via CLI
- Familiar API for developers coming from Java/Spring (Hibernate-like)

Drizzle ORM is lighter and faster but has less NestJS integration. Prisma generates
excellent types but adds a code generation step and has slower cold starts (relevant
for Lambda).

## Alternatives considered

| Alternative | Why rejected                                                     |
| ----------- | ---------------------------------------------------------------- |
| Drizzle ORM | Less NestJS integration; newer ecosystem; fewer community resources |
| Prisma      | Code generation step; slower cold starts for Lambda; heavier bundle |
| Raw SQL     | More boilerplate; harder to maintain; no entity relationship management |

## Consequences

**Positive:**

- Seamless NestJS integration with decorators and dependency injection
- Entity relationships are declarative and type-safe
- Migration system works well with CI/CD pipeline

**Negative / risks:**

- TypeORM has a larger bundle size than Drizzle
- Some query patterns require raw SQL or query builder
- TypeORM's TypeScript types can be verbose for complex queries
