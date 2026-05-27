# 7. Data Models

> [← Back to index](./README.md)

## 7.1 PostgreSQL schema

```sql
-- Endpoint registry
CREATE TABLE endpoints (
  id            VARCHAR(26) PRIMARY KEY,          -- ULID
  name          VARCHAR(255) NOT NULL,
  destination_url TEXT,
  secret        VARCHAR(255),                      -- HMAC secret (stored encrypted)
  provider      VARCHAR(20) DEFAULT 'generic',     -- generic | github | stripe | shopify
  status        VARCHAR(20) DEFAULT 'active',      -- active | paused | deleted
  max_retries   INT DEFAULT 5,
  retry_base_delay_ms INT DEFAULT 5000,
  dlq_threshold INT DEFAULT 100,
  cb_failure_threshold NUMERIC(3,2) DEFAULT 0.80,  -- circuit breaker failure rate threshold
  cb_window_seconds INT DEFAULT 300,               -- circuit breaker rolling window
  cb_cooldown_seconds INT DEFAULT 120,             -- circuit breaker cooldown after trip
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Raw events
CREATE TABLE events (
  id            VARCHAR(26) PRIMARY KEY,           -- ULID
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  payload       JSONB NOT NULL,
  headers       JSONB,
  source_ip     INET,
  status        VARCHAR(20) DEFAULT 'received',    -- received | processing | delivered | failed | dead_lettered
  category      VARCHAR(100),                      -- AI-assigned classification
  trace_id      VARCHAR(64),
  received_at   TIMESTAMPTZ DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  INDEX         (endpoint_id, received_at DESC),
  INDEX         (status),
  INDEX         (category)
);

-- Delivery attempts
CREATE TABLE delivery_attempts (
  id            BIGSERIAL PRIMARY KEY,
  event_id      VARCHAR(26) NOT NULL REFERENCES events(id),
  attempt_number INT NOT NULL,
  destination_url TEXT NOT NULL,
  http_status   INT,
  response_body TEXT,                              -- truncated to 4KB
  latency_ms    INT,
  status        VARCHAR(20),                       -- success | failed | timeout | circuit_open
  attempted_at  TIMESTAMPTZ DEFAULT NOW(),
  INDEX         (event_id)
);

-- Dead-letter queue
CREATE TABLE dlq_events (
  id            VARCHAR(26) PRIMARY KEY,
  event_id      VARCHAR(26) NOT NULL REFERENCES events(id),
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  failure_reason TEXT,                             -- includes 'circuit_open' as a valid reason
  attempts_json JSONB,                             -- snapshot of all delivery_attempts
  endpoint_snapshot JSONB,                         -- endpoint config at time of failure
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  retried_at    TIMESTAMPTZ,
  INDEX         (endpoint_id, created_at DESC)
);

-- Routing rules
CREATE TABLE routing_rules (
  id            BIGSERIAL PRIMARY KEY,
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  priority      INT NOT NULL DEFAULT 0,
  match_type    VARCHAR(20) NOT NULL,              -- header | json_path | source_ip
  match_key     VARCHAR(255),                      -- e.g. 'X-Event-Type' or '$.event.type'
  match_value   VARCHAR(255),
  destination_type VARCHAR(20),                    -- http | slack | discord | discard
  destination_url TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE        (endpoint_id, priority)
);

-- AI summaries
CREATE TABLE ai_summaries (
  id            BIGSERIAL PRIMARY KEY,
  endpoint_id   VARCHAR(26) NOT NULL REFERENCES endpoints(id),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  summary_text  TEXT NOT NULL,
  event_count   INT,
  failure_count INT,
  top_categories JSONB,
  model         VARCHAR(50),
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE        (endpoint_id, period_start)
);
```

## 7.2 SQS message schema

```typescript
// Ingestion queue message body
interface IngestionMessage {
  event_id: string; // ULID
  endpoint_id: string; // ULID
  payload_ref?: string; // S3 key if payload > 256KB
  received_at: string; // ISO 8601
  trace_id: string;
}

// DLQ message body (passed by SQS after maxReceiveCount)
interface DLQMessage {
  event_id: string;
  endpoint_id: string;
  failure_reason: string;
  original_message: IngestionMessage;
}
```

## 7.3 Redis circuit breaker schema

```
hookmate:circuit:{endpointId}:state
  Type: string
  Value: 'open' | 'half-open'
  TTL: cb_cooldown_seconds (absent = closed)

hookmate:circuit:{endpointId}:window
  Type: sorted set
  Members: "{attempt_id}:{outcome}"  (outcome: 1=success, 0=failure)
  Score: Unix timestamp of attempt
  TTL: cb_window_seconds
  — ZREMRANGEBYSCORE used to evict attempts outside the rolling window before each read
```
