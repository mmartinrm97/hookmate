# Runbook

## How to Handle DLQ Alerts

### Alert Triggered

When CloudWatch alarm `DLQDepthThreshold` fires:

1. **Check the alarm details** in CloudWatch Console
   - Navigate to CloudWatch → Alarms → `DLQDepthThreshold`
   - Note the endpoint ID and current DLQ depth

2. **Investigate the root cause**

   ```bash
   # Query recent DLQ events for the endpoint
   psql -h localhost -p 5433 -U hookmate -d hookmate -c "
     SELECT de.id, de.endpoint_id, de.error_message, de.created_at
     FROM dlq_events de
     WHERE de.endpoint_id = '<endpoint-id>'
     ORDER BY de.created_at DESC
     LIMIT 20;
   "
   ```

3. **Common causes**
   - Destination URL is down or returning 5xx
   - Destination changed authentication requirements
   - Payload format mismatch
   - Network timeout (destination slow)

4. **Resolution options**
   - **Retry all**: If destination is back online
     ```bash
     curl -X POST http://localhost:3000/api/dlq/retry-all \
       -H "Authorization: Bearer local-dev-key"
     ```
   - **Retry individual**: For specific events
     ```bash
     curl -X POST http://localhost:3000/api/dlq/<event-id>/retry \
       -H "Authorization: Bearer local-dev-key"
     ```
   - **Purge**: If events are stale and should be discarded
     ```bash
     curl -X DELETE http://localhost:3000/api/dlq/purge \
       -H "Authorization: Bearer local-dev-key"
     ```
   - **Pause endpoint**: Stop ingestion while investigating
     ```bash
     curl -X PATCH http://localhost:3000/api/endpoints/<endpoint-id> \
       -H "Authorization: Bearer local-dev-key" \
       -H "Content-Type: application/json" \
       -d '{"status": "paused"}'
     ```

## How to Drain Queues

### Drain Ingestion Queue

When you need to stop processing new events:

1. **Pause the endpoint** (stops new ingestion)

   ```bash
   curl -X PATCH http://localhost:3000/api/endpoints/<endpoint-id>/pause \
     -H "Authorization: Bearer local-dev-key"
   ```

2. **Check queue depth**

   ```bash
   # Via AWS CLI (local Floci)
   aws --endpoint-url http://localhost:4566 sqs get-queue-attributes \
     --queue-url http://localhost:4566/000000000000/hookmate-ingestion \
     --attribute-names ApproximateNumberOfMessages
   ```

3. **Wait for processor to drain** (or stop the processor service)

   ```bash
   # Stop API (which runs the processor in dev mode)
   # Events will remain in queue until processor restarts
   ```

4. **Purge queue** (if you want to discard all pending messages)
   ```bash
   aws --endpoint-url http://localhost:4566 sqs purge-queue \
     --queue-url http://localhost:4566/000000000000/hookmate-ingestion
   ```

### Drain DLQ

1. **Retry all DLQ events** (if destination is fixed)

   ```bash
   curl -X POST http://localhost:3000/api/dlq/retry-all \
     -H "Authorization: Bearer local-dev-key"
   ```

2. **Purge DLQ** (if events are stale)
   ```bash
   curl -X DELETE http://localhost:3000/api/dlq/purge \
     -H "Authorization: Bearer local-dev-key"
   ```

## How to Roll Back a Deploy

### CDK Rollback

1. **Identify the previous successful deployment**

   ```bash
   cd infrastructure
   cdk list  # list all stacks
   ```

2. **Deploy the previous version**

   ```bash
   # Checkout the previous commit
   git checkout <previous-commit-hash>

   # Deploy all stacks
   cdk deploy --all

   # Or deploy specific stack
   cdk deploy HookMateComputeStack
   ```

3. **Verify rollback**
   - Check CloudWatch logs for error rates
   - Test ingestion endpoint manually
   - Verify dashboard is accessible

### Manual Rollback (Emergency)

If CDK deploy fails and you need to restore quickly:

1. **Stop the failing Lambda**

   ```bash
   aws lambda update-function-configuration \
     --function-name HookMateIngestionLambda \
     --reserved-concurrency 0
   ```

2. **Republish previous version**

   ```bash
   # Get the previous version ARN from Lambda console
   aws lambda publish-version \
     --function-name HookMateIngestionLambda \
     --description "Rollback to stable version"
   ```

3. **Update alias to point to stable version**
   ```bash
   aws lambda update-alias \
     --function-name HookMateIngestionLambda \
     --name prod \
     --function-version <stable-version>
   ```

## How to Check System Health

### Quick Health Check

```bash
# API health endpoint (no auth required)
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}
```

### Database Health

```bash
# Check connection count
psql -h localhost -p 5433 -U hookmate -d hookmate -c "
  SELECT count(*) as connections, state
  FROM pg_stat_activity
  GROUP BY state;
"

# Check table sizes
psql -h localhost -p 5433 -U hookmate -d hookmate -c "
  SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) as size
  FROM pg_class
  WHERE relname IN ('endpoints', 'events', 'delivery_attempts', 'dlq_events')
  ORDER BY pg_total_relation_size(oid) DESC;
"
```

### Queue Health

```bash
# Check SQS queue depth
aws --endpoint-url http://localhost:4566 sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/hookmate-ingestion \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible

# Check DLQ depth
aws --endpoint-url http://localhost:4566 sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/hookmate-dlq \
  --attribute-names ApproximateNumberOfMessages
```

### Redis Health

```bash
# Check Redis connection
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Check BullMQ queues
redis-cli -h localhost -p 6379 keys "bull:*"
```

## Common Issues

### API Won't Start

1. **Check PostgreSQL is running**

   ```bash
   docker ps | grep postgres
   docker-compose up -d postgres
   ```

2. **Check Redis is running**

   ```bash
   docker ps | grep redis
   docker-compose up -d redis
   ```

3. **Check Floci is running**

   ```bash
   docker ps | grep floci
   docker-compose up -d floci
   ```

4. **Check environment variables**
   ```bash
   cat apps/api/.env
   # Ensure POSTGRES_HOST, POSTGRES_PORT, REDIS_URL are correct
   ```

### Events Not Being Processed

1. **Check SQS queue has messages**

   ```bash
   aws --endpoint-url http://localhost:4566 sqs get-queue-attributes \
     --queue-url http://localhost:4566/000000000000/hookmate-ingestion \
     --attribute-names ApproximateNumberOfMessages
   ```

2. **Check processor is running**

   ```bash
   # Look for processor logs in API output
   # Should see: "Processing message: { event_id, endpoint_id }"
   ```

3. **Check Redis/BullMQ connection**
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

### DLQ Growing Rapidly

1. **Check destination health**

   ```bash
   curl -I <destination-url>
   ```

2. **Check error messages in DLQ**

   ```bash
   psql -h localhost -p 5433 -U hookmate -d hookmate -c "
     SELECT error_message, count(*) as count
     FROM dlq_events
     GROUP BY error_message
     ORDER BY count DESC
     LIMIT 10;
   "
   ```

3. **Pause endpoint to stop the bleeding**
   ```bash
   curl -X PATCH http://localhost:3000/api/endpoints/<endpoint-id>/pause \
     -H "Authorization: Bearer local-dev-key"
   ```
