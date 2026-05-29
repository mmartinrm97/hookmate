# ADR-003: CDK as primary IaC with Terraform mirror

**Date:** 2026-05-01  
**Status:** Accepted  
**Deciders:** Martin

## Context

Infrastructure as Code (IaC) is needed to provision AWS resources: VPC, RDS,
SQS, ElastiCache, Lambda functions, API Gateway, S3, CloudFront, and EventBridge.
Options considered:

- AWS CDK (TypeScript)
- Terraform (HCL)
- AWS CloudFormation (YAML/JSON)
- Pulumi (TypeScript)

## Decision

Use AWS CDK v2 (TypeScript) as the primary IaC tool, with a Terraform mirror
in the `terraform/` directory for portfolio demonstration purposes.

## Rationale

CDK was chosen as primary because:

- TypeScript throughout the stack — same language for API, infra, and tests
- Higher-level constructs (e.g., `Queue`, `Function`) reduce boilerplate
- Type safety catches errors at synth time, not deploy time
- Better integration with AWS services and latest features
- `cdk diff` provides clear infrastructure change previews

Terraform mirror exists to demonstrate proficiency with both tools and allow
comparison of approaches for the portfolio.

## Alternatives considered

| Alternative  | Why rejected                                                     |
| ------------ | ---------------------------------------------------------------- |
| Terraform    | HCL is a DSL; less type safety; separate language from app code  |
| CloudFormation | Verbose YAML/JSON; no programming language features; harder to maintain |
| Pulumi       | Similar to CDK but smaller AWS-specific ecosystem; CDK is AWS-first |

## Consequences

**Positive:**

- Single language (TypeScript) across the entire codebase
- Type-safe infrastructure definitions catch errors early
- CDK constructs enable reusable, testable infrastructure patterns
- Terraform mirror demonstrates multi-tool proficiency

**Negative / risks:**

- CDK lock-in to AWS; harder to migrate to other clouds
- Terraform mirror may drift from CDK if not kept in sync
- CDK synth requires building the API bundle first (Lambda asset)
