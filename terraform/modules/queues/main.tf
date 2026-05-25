# ===========================================================================
# Queues Module — SQS Queues
# ===========================================================================
# Mirrors QueueStack (infrastructure/lib/queue-stack.ts).
#
# Creates 4 SQS queues:
#   - DLQ (dead-letter): receives messages that exceeded max retries
#   - Ingestion: main webhook event queue (DLQ after 3 retries)
#   - Retry: BullMQ retry queue (DLQ after 5 retries)
#   - AI Jobs: lightweight queue for background AI work
# ===========================================================================

# ---------------------------------------------------------------------------
# Dead-Letter Queue
# ---------------------------------------------------------------------------
# Long retention (14 days) so operators can inspect and replay failed events.
# No redrive policy — this IS the terminal DLQ.
resource "aws_sqs_queue" "dlq" {
  name                       = "${var.project_name}-dlq"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 1209600 # 14 days
  sqs_managed_sse_enabled    = true

  tags = {
    Name = "${var.project_name}-dlq"
  }
}

# ---------------------------------------------------------------------------
# Ingestion Queue
# ---------------------------------------------------------------------------
# Webhook events land here after the Ingestion Lambda writes them to the DB.
# After 3 failed delivery attempts, the message moves to the DLQ.
# Matches CDK: Queue with deadLetterQueue { queue: dlq, maxReceiveCount: 3 }
resource "aws_sqs_queue" "ingestion" {
  name                       = "${var.project_name}-ingestion"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 days
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-ingestion"
  }
}

# ---------------------------------------------------------------------------
# Retry Queue
# ---------------------------------------------------------------------------
# BullMQ uses this queue to schedule retry jobs with exponential backoff.
# Separate from ingestion to avoid head-of-line blocking on retries.
# After 5 failed attempts, messages move to the DLQ.
resource "aws_sqs_queue" "retry" {
  name                       = "${var.project_name}-retry"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 days
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name = "${var.project_name}-retry"
  }
}

# ---------------------------------------------------------------------------
# AI Job Queue
# ---------------------------------------------------------------------------
# Lightweight queue for AI summary/classification background jobs.
# Shorter timeout (60s) since AI calls may take longer. No DLQ for this queue
# — AI failures are non-blocking and only logged (per spec).
resource "aws_sqs_queue" "ai_jobs" {
  name                       = "${var.project_name}-ai-jobs"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400 # 1 day
  sqs_managed_sse_enabled    = true

  tags = {
    Name = "${var.project_name}-ai-jobs"
  }
}
