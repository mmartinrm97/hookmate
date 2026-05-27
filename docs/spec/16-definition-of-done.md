# 16. Definition of Done

> [← Back to index](./README.md)

## Feature DoD (applies to each individual feature)

A feature is "done" when:

1. Code is merged to `main` via a PR with at least one review approval
2. Unit tests pass with ≥ 80% line coverage for new code
3. Integration tests cover the happy path and at least one failure path
4. No oxlint errors
5. TypeScript compiles with `strict: true` and zero `any` types in new code
6. OpenTelemetry spans instrumented for new code paths
7. Acceptance criteria for the feature are verified as passing

## Project DoD

The project is "done" when:

- All 23 acceptance criteria (AC-01 through AC-23) pass
- Development checklist has ≥ 75 items checked
- Application is deployed to AWS (`us-east-1`)
- Live demo URL is functional and listed in `README.md` (AC-22)
- Public GitHub repository with clean commit history using Conventional Commits
- `npx cdk synth` completes without errors
- `terraform plan` completes without errors
- `terraform/COMPARISON.md` documents key CDK vs Terraform differences (including Infracost)
- CloudWatch dashboard is live and displaying real metrics
- `docs/cost-analysis.md` exists with per-traffic-tier cost estimates from a real Infracost run
- All 4 ADR files exist under `docs/decisions/` (001 through 004)

---

_Document version: 2.0 — May 2026_
