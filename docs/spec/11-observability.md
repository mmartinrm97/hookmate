# 11. Observability

> [← Back to index](./README.md)

## 11.1 OpenTelemetry SDK init

```typescript
// apps/api/src/telemetry/init.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { XRayExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

export const otelSdk = new NodeSDK({
  traceExporter: new XRayExporter(),
  idGenerator: new AWSXRayIdGenerator(),
  textMapPropagator: new AWSXRayPropagator(),
});

// Call before NestJS bootstraps
otelSdk.start();
```

## 11.2 Required spans

| Span name                 | Attributes                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `hookmate.ingest`         | `endpoint.id`, `event.id`, `http.method`, `http.status`                             |
| `hookmate.sig.verify`     | `endpoint.id`, `sig.valid`, `sig.provider` (generic \| github \| stripe \| shopify) |
| `hookmate.db.write`       | `db.table`, `event.id`                                                              |
| `hookmate.queue.publish`  | `queue.url`, `event.id`                                                             |
| `hookmate.circuit.check`  | `endpoint.id`, `circuit.state` (closed \| open \| half-open)                        |
| `hookmate.process`        | `endpoint.id`, `event.id`, `attempt.number`                                         |
| `hookmate.route.eval`     | `rule.id`, `rule.matched`, `destination.type`                                       |
| `hookmate.deliver`        | `destination.url`, `http.status`, `latency_ms`                                      |
| `hookmate.circuit.update` | `endpoint.id`, `circuit.outcome` (success \| failure), `circuit.new_state`          |
| `hookmate.ai.generate`    | `endpoint.id`, `model`, `token.count`                                               |
| `hookmate.dlq.write`      | `endpoint.id`, `event.id`, `failure_reason`                                         |

## 11.3 CloudWatch dashboard widgets

```
Row 1: [Ingestion Lambda invocations] [Ingestion Lambda P99 duration]
Row 2: [SQS queue depth]             [Processor Lambda error rate]
Row 3: [DLQ depth]                   [Circuit breaker trips (last 1h)]
Row 4: [AI Lambda last run status]   [Circuit state per endpoint (table)]
```

## 11.4 Alarms

| Alarm               | Threshold          | Action                    |
| ------------------- | ------------------ | ------------------------- |
| IngestionErrorRate  | > 1% in 5min       | SNS → Slack               |
| ProcessorErrorRate  | > 5% in 5min       | SNS → Slack               |
| DLQDepth            | > 100 messages     | SNS → Slack               |
| IngestionLatencyP99 | > 200ms            | SNS → PagerDuty           |
| CircuitBreakerTrips | > 3 trips in 10min | SNS → Slack               |
| AILambdaErrors      | > 3 in 30min       | SNS → CloudWatch log only |
