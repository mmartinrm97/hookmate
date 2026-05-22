# HookMate Terraform bootstrap

This directory intentionally starts with a minimal Terraform skeleton so the monorepo has a real
place for the IaC mirror described in `docs/hookmate-spec.md`.

## Current scope

- provider and version pinning
- region variable
- project local values
- outputs that confirm bootstrap wiring

## Next slices

1. networking baseline
2. queues and DLQ
3. database and cache
4. lambdas and API Gateway
5. monitoring and frontend delivery
