# 1. Overview

> [← Back to index](./README.md)

**HookMate** is a production-grade, event-driven webhook automation platform. It ingests webhook events from any source, processes them through configurable async pipelines, handles retries with exponential backoff, routes dead-letter events to a DLQ with full context, and delivers AI-generated summaries and classifications of event activity to configured destinations (Slack, Discord, email).

**One-line pitch:** "Webhook infrastructure that actually works — ingestion, retries, DLQ, routing, and AI summaries, all deployed on AWS via CDK."

**Portfolio signals this project demonstrates:**

- Production-grade event-driven system design (not a CRUD app)
- AWS CDK fluency: SQS, SNS, EventBridge, Lambda, RDS, API Gateway, CloudWatch
- Terraform parity: same infrastructure expressed in HCL
- GitHub Actions CI/CD with CDK deploy on merge
- OpenTelemetry instrumentation end-to-end
- AI integration as a utility layer (summaries/classification), not as the product itself
