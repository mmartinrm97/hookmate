# 12. Security

> [← Back to index](./README.md)

## 12.1 HMAC verification — generic

```typescript
// apps/api/src/webhooks/hmac.ts
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyHmacSignature(
  payload: Buffer,
  secret: string,
  signature: string, // format: "sha256=<hex>"
): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

**Note:** `timingSafeEqual` is mandatory to prevent timing-based side-channel attacks.

## 12.2 IAM least privilege

| Function              | SQS           | RDS       | Secrets Manager           | SNS       | S3        |
| --------------------- | ------------- | --------- | ------------------------- | --------- | --------- |
| Ingestion Lambda      | SendMessage   | Read      | GetSecretValue            | —         | PutObject |
| Processor Lambda      | ReceiveMessage, DeleteMessage | Read/Write | GetSecretValue | Publish | GetObject |
| DLQ Lambda            | ReceiveMessage, DeleteMessage | Write     | GetSecretValue            | Publish   | —         |
| AI Background Lambda  | —             | Read/Write| GetSecretValue            | —         | —         |
| NestJS API Lambda     | —             | Read/Write| GetSecretValue            | —         | —         |

## 12.3 API key authentication

API keys are stored in Secrets Manager (`hookmate/api-key`). The NestJS API uses a `@Guard` that:

1. Reads the raw `Authorization: Bearer <token>` header
2. Calls Secrets Manager `GetSecretValue` (cached in Lambda memory, refreshed every 5min)
3. Compares using `timingSafeEqual` — no short-circuit comparison

## 12.4 Payload encryption at rest

- RDS PostgreSQL is provisioned with `storageEncrypted: true` (AES-256, AWS-managed key)
- SQS queues use `sqs.QueueEncryption.KMS_MANAGED`
- Lambda environment variables containing secret ARNs (not plaintext secrets) are encrypted by Lambda's KMS key at rest

## 12.5 Multi-provider webhook signature adapters

Provider implementations live in `packages/shared/src/webhook-providers/`.

| Provider  | Header                     | Format                          | Extra validation                          |
| --------- | -------------------------- | ------------------------------- | ----------------------------------------- |
| GitHub    | `X-Hub-Signature-256`      | `sha256=<hex>`                  | none                                      |
| Generic   | `X-Hub-Signature-256`      | `sha256=<hex>`                  | none                                      |
| Stripe    | `X-Stripe-Signature`       | `t=<unix_ts>,v1=<hex>`          | Reject if `|now - t| > 300s` (replay)     |
| Shopify   | `X-Shopify-Hmac-SHA256`    | `<base64>`                      | Decode base64, compare hex                |

**Stripe adapter (example):**

```typescript
// packages/shared/src/webhook-providers/stripe.adapter.ts
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyStripeSignature(
  payload: Buffer,
  secret: string,
  header: string, // "t=1234567890,v1=abc123..."
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=')),
  );
  const timestamp = parseInt(parts['t'], 10);
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return false; // replay attack prevention
  }
  const signed = `${timestamp}.${payload.toString()}`;
  const expected = createHmac('sha256', secret).update(signed).digest('hex');
  const a = Buffer.from(parts['v1'] ?? '');
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```
