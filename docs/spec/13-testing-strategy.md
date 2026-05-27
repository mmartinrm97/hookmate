# 13. Testing Strategy

> [← Back to index](./README.md)

## 13.1 Unit tests (Vitest)

Target: **80% line coverage** across all Lambda handlers and service classes.

Test areas:

- HMAC signature verification — all provider adapters (GitHub, Stripe with timestamp tolerance, Shopify base64 decode, generic fallback)
- Circuit breaker state machine: closed → open (failure threshold), open → half-open (TTL expiry), half-open → closed (probe success), half-open → open (probe failure)
- Routing rule evaluation (priority order, first-match-wins, no-match fallback)
- Retry backoff calculation
- Event status transitions
- AI classification prompt building + Zod schema parsing of `generateObject` response
- Provider adapter auto-detection (header presence, priority order)

Run with: `pnpm test:unit` in `apps/api/`

## 13.2 Integration tests (Floci)

**Floci** (`hectorvent/floci`) is a lightweight LocalStack replacement emulating: SQS, SNS, EventBridge, Lambda, API Gateway, Secrets Manager. Runs on port 4566.

```yaml
# docker-compose.yml (services excerpt)
services:
  postgres:
    image: postgres:16
    ports: ['5432:5432']
    environment:
      POSTGRES_DB: hookmate
      POSTGRES_USER: hookmate
      POSTGRES_PASSWORD: hookmate_dev

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  floci:
    image: hectorvent/floci:latest
    ports: ['4566:4566']
    volumes:
      - ./data/floci:/var/lib/floci
```

AWS client setup for tests:

```typescript
// apps/api/test/helpers/aws-clients.ts
import { SQSClient } from '@aws-sdk/client-sqs';

export const sqs = new SQSClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
```

Floci test scenarios:

1. **Ingestion → SQS publish**: POST event, verify SQS message appears in queue
2. **Processor → delivery**: Seed SQS message, mock HTTP destination, verify `events.status = delivered`
3. **Retry flow**: Mock destination returns 503 three times, verify BullMQ retries and attempt records
4. **DLQ write**: Exhaust all retries, verify `dlq_events` row written and SNS notification published
5. **Routing rule match**: Seed event with matching header, verify routed to correct destination
6. **AI background job**: Seed 10 events, trigger AI Lambda, verify `ai_summaries` row upserted
7. **Circuit breaker trip**: Seed 10 consecutive failures for same endpoint, verify Redis state = `open` and 11th event goes directly to DLQ with `circuit_open`
8. **Circuit breaker half-open probe**: Manually set Redis TTL to 0, send event, verify probe attempt, verify state = `closed` after 200 response
9. **Provider signature adapters**: Send Stripe-signed event (valid), Stripe-signed (timestamp stale → 408), Shopify-signed (valid base64), GitHub-signed (valid hex)
10. **Secrets Manager rotation**: Rotate `hookmate/api-key` secret in Floci, verify Lambda refreshes cache on next invocation and accepts new key

**Floci facts:**

- All Floci resources are seeded via JSON files in `data/floci/` — committed to the repo
- Tests are idempotent: `TRUNCATE events, delivery_attempts, dlq_events CASCADE` before each suite
- No real AWS credentials needed for any test

## 13.3 E2E tests (Playwright)

Scenarios:

1. User creates endpoint, receives an event, sees it in the dashboard event log
2. User retries a DLQ event and sees it move to `delivered`
3. User creates a routing rule and verifies the next event is routed to the new destination
4. User views circuit breaker state panel; manually resets an open circuit; verifies state shows `closed`

Run with: `pnpm test:e2e` in `apps/dashboard/`

## 13.4 Load test (k6)

```javascript
// apps/api/test/load/ingestion.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '60s', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post(
    `http://localhost:3000/webhooks/${__ENV.ENDPOINT_ID}`,
    JSON.stringify({ type: 'test', data: { load: true } }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { '202 accepted': (r) => r.status === 202 });
}
```

## 13.5 GitHub Actions CI

```yaml
# .github/workflows/ci.yml
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: hookmate, POSTGRES_USER: hookmate, POSTGRES_PASSWORD: hookmate_ci }
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
      floci:
        image: hectorvent/floci:latest
        ports: ['4566:4566']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test

  cdk-synth:
    runs-on: ubuntu-latest
    needs: lint-and-test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: cd infrastructure && npx cdk synth

  infracost:
    runs-on: ubuntu-latest
    needs: lint-and-test
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: infracost/actions/setup@v3
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}
      - run: infracost breakdown --path terraform/ --format json --out-file /tmp/infracost.json
      - uses: infracost/actions/comment@v3
        with:
          path: /tmp/infracost.json
          behavior: update

  deploy:
    runs-on: ubuntu-latest
    needs: [cdk-synth, infracost]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: cd infrastructure && npx cdk deploy --all --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```
