# 3. Purpose & Goals

> [← Back to index](./README.md)

## Primary goal

Build a system that a real team would actually run in production to manage their webhook infrastructure.

## Learning goals (portfolio-specific)

| Goal                            | What you learn                                                  |
| ------------------------------- | --------------------------------------------------------------- |
| AWS CDK — SQS, SNS, EventBridge | IaC for event-driven cloud architecture                         |
| Terraform parity                | Declarative infra in HCL; comparison with CDK                   |
| BullMQ at scale                 | Queue semantics, backpressure, consumer groups, concurrency     |
| GitHub Actions + CDK deploy     | Real CI/CD pipeline that deploys to AWS on push                 |
| OpenTelemetry                   | Distributed tracing across async workers                        |
| AI as a utility                 | Summaries and classification as a background job, not a chatbot |
| Circuit breaker                 | Distributed systems resilience pattern in Redis                 |
| Multi-provider signatures       | Real-world webhook contracts differ; adapters document them     |
| Infracost                       | Cost-aware IaC: every PR shows its monthly cost delta           |

## Non-goals

- This is not an iPaaS or full workflow automation platform (not Zapier)
- No visual drag-and-drop workflow builder
- No custom scripting runtime for event transformations
- No multi-tenancy in v1
