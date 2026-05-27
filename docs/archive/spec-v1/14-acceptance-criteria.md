# 14. Acceptance Criteria

> [← Back to index](./README.md)

All AC are written in Given/When/Then (BDD) format.

---

**AC-01 — Webhook ingestion returns 202**

> Given a valid `endpointId` exists and is active  
> When a POST is made to `/webhooks/{endpointId}` with any JSON body  
> Then the response is `202 Accepted` with `{ event_id, trace_id }`  
> And the event row is persisted in PostgreSQL before the response is sent

**AC-02 — Unknown endpoint returns 404**

> Given an `endpointId` that does not exist in the database  
> When a POST is made to `/webhooks/{endpointId}`  
> Then the response is `404 Not Found`

**AC-03 — Invalid HMAC returns 400**

> Given an endpoint with HMAC verification enabled  
> When a POST is made with an incorrect `X-Hub-Signature-256` header  
> Then the response is `400 Bad Request`  
> And no event row is written

**AC-04 — Event delivered within SLA**

> Given a destination URL that responds with `200` within 2 seconds  
> When a valid event is ingested  
> Then `events.status` transitions to `delivered` within 10 seconds of ingestion

**AC-05 — Retry on non-2xx destination**

> Given a destination URL that returns `503`  
> When a valid event is processed  
> Then BullMQ schedules a retry with backoff starting at 5 seconds  
> And a `delivery_attempts` row is written for each failed attempt

**AC-06 — Event moved to DLQ after max retries**

> Given a destination URL that always returns `503`  
> When max retry attempts are exhausted  
> Then the event is written to `dlq_events` with `failure_reason`  
> And `events.status` is updated to `dead_lettered`

**AC-07 — DLQ depth alarm fires**

> Given a DLQ threshold of 5 for an endpoint  
> When 6 events are moved to the DLQ for that endpoint  
> Then a CloudWatch alarm transitions to `ALARM` state  
> And an SNS notification is published

**AC-08 — Manual DLQ retry re-enqueues event**

> Given a DLQ event exists for an endpoint  
> When `POST /api/dlq/{id}/retry` is called  
> Then the event is re-enqueued into BullMQ with `attempt_number = 0`  
> And the DLQ record's `retried_at` timestamp is updated

**AC-09 — Routing rule directs to alternate destination**

> Given a routing rule matching `X-Event-Type: payment.failed` → Slack webhook  
> When an event with that header is ingested  
> Then the processor delivers the event to the Slack webhook URL, not the default destination

**AC-10 — Routing rule discard drops event silently**

> Given a routing rule matching `$.event.type: internal_ping` → discard  
> When such an event is ingested  
> Then `events.status = delivered` (treated as successful)  
> And no outbound HTTP call is made

**AC-11 — AI summary generated every 30 minutes**

> Given at least 1 event received in the last 24h for an endpoint  
> When the EventBridge scheduler triggers the AI Lambda  
> Then an `ai_summaries` row is created (or updated) for that endpoint  
> And `summary_text` is a non-empty natural language string

**AC-12 — AI failure does not affect event processing**

> Given the OpenAI API returns a 500 error  
> When the AI background Lambda runs  
> Then no event records are mutated to a failed status  
> And the error is logged to CloudWatch

**AC-13 — Dashboard event log displays events**

> Given events exist for an endpoint  
> When the user opens the event log filtered by that endpoint  
> Then events are listed with: event ID, status badge, category, received_at, delivery latency

**AC-14 — Endpoint pause halts processing**

> Given an endpoint in `active` status with events in queue  
> When `POST /api/endpoints/{id}/pause` is called  
> Then the Processor Lambda skips processing for that endpoint  
> And new events continue to be ingested (but not processed)

**AC-15 — CDK synth succeeds without AWS credentials**

> Given the CDK app TypeScript compiles without errors  
> When `npx cdk synth` is run in `infrastructure/`  
> Then all stacks synthesize to CloudFormation JSON without AWS API calls

**AC-16 — Terraform plan generates no errors**

> Given valid Terraform configuration in `terraform/`  
> When `terraform plan -out=plan.tfplan` is run against a mock backend  
> Then the plan completes with no errors

**AC-17 — All spans reachable via trace ID**

> Given a delivered event with a known `trace_id`  
> When the trace is queried in AWS X-Ray  
> Then all spans (ingest → db.write → queue.publish → process → deliver) are present and linked

**AC-18 — Terraform parity with CDK**

> Given the CDK and Terraform configurations describe the same resources  
> When both are synthesized/planned  
> Then both create the same set of core resources (VPC, RDS, SQS, Redis, Lambdas, API GW, CloudFront)  
> And any intentional differences are documented in `terraform/COMPARISON.md`
