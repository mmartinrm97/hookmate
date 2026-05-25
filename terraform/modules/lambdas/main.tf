# ===========================================================================
# Lambdas Module — Lambda Functions + IAM Roles
# ===========================================================================
# Mirrors ComputeStack (infrastructure/lib/compute-stack.ts).
#
# Creates 4 Lambda functions (Ingestion, Processor, DLQ, AI) with their
# IAM execution roles. Each role follows least-privilege principles — only
# the specific actions needed (not CDK's grant* method abstractions).
#
# Permission matrix (from spec section 12.2):
#   Ingestion  → sqs:SendMessage (ingestion queue), secretsmanager:GetSecretValue
#   Processor  → sqs:ReceiveMessage/DeleteMessage (ingestion), sqs:SendMessage (retry+dlq)
#   DLQ        → sqs:ReceiveMessage/DeleteMessage (DLQ), secretsmanager:GetSecretValue
#   AI         → sqs:SendMessage (AI queue), secretsmanager:GetSecretValue
#
# ALL Lambdas: logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents,
#              ec2:CreateNetworkInterface, ec2:DescribeNetworkInterfaces, ec2:DeleteNetworkInterface,
#              xray:PutTraceSegments, xray:PutTelemetryRecords
# ===========================================================================

# ---------------------------------------------------------------------------
# Base IAM Policy (shared by all Lambda functions)
# ---------------------------------------------------------------------------
# Every Lambda needs:
#   1. CloudWatch Logs — write logs to /aws/lambda/<function-name>
#   2. X-Ray — active tracing (CDK: Tracing.ACTIVE)
#   3. VPC ENI — create/manage elastic network interfaces in the VPC
data "aws_iam_policy_document" "lambda_base_permissions" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    # CDK creates a log group per function named /aws/lambda/<function-name>
    # We scope the policy to only write to those log groups
    resources = [
      "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-*:*",
    ]
  }

  statement {
    sid    = "XRayTracing"
    effect = "Allow"
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "VPCNetworkInterface"
    effect = "Allow"
    actions = [
      "ec2:CreateNetworkInterface",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DeleteNetworkInterface",
      "ec2:AssignPrivateIpAddresses",
      "ec2:UnassignPrivateIpAddresses",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "lambda_base" {
  name        = "${var.project_name}-lambda-base-policy"
  description = "Base permissions for all HookMate Lambda functions (logs, X-Ray, VPC ENI)"
  policy      = data.aws_iam_policy_document.lambda_base_permissions.json

  tags = {
    Name = "${var.project_name}-lambda-base-policy"
  }
}

# ---------------------------------------------------------------------------
# Lambda Execution Role (generic, reused across all functions)
# ---------------------------------------------------------------------------
# Trust policy allowing Lambda service to assume the role.
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  description = "Execution role for HookMate Lambda functions"

  tags = {
    Name = "${var.project_name}-lambda-execution-role"
  }
}

# Attach base policy to the execution role
resource "aws_iam_role_policy_attachment" "lambda_base" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_base.arn
}

# ===========================================================================
# Per-Function IAM Policies
# ===========================================================================

# ---------------------------------------------------------------------------
# Ingestion Lambda Policy
# ---------------------------------------------------------------------------
# Permissions: SendMessage to ingestion queue, GetSecretValue for DB + OpenAI secrets
data "aws_iam_policy_document" "ingestion_permissions" {
  statement {
    sid    = "SQSSendMessage"
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [var.ingestion_queue_arn]
  }

  statement {
    sid    = "SecretsManagerRead"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = [
      var.db_secret_arn,
      var.openai_secret_arn,
    ]
  }
}

resource "aws_iam_policy" "ingestion" {
  name        = "${var.project_name}-ingestion-policy"
  description = "Permissions for Ingestion Lambda"
  policy      = data.aws_iam_policy_document.ingestion_permissions.json

  tags = {
    Name = "${var.project_name}-ingestion-policy"
  }
}

resource "aws_iam_role_policy_attachment" "ingestion" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.ingestion.arn
}

# ---------------------------------------------------------------------------
# Processor Lambda Policy
# ---------------------------------------------------------------------------
# Permissions: Consume from ingestion queue, send to ingestion + retry + DLQ,
# read secrets for DB + OpenAI access
data "aws_iam_policy_document" "processor_permissions" {
  statement {
    sid    = "SQSConsumeIngestion"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [var.ingestion_queue_arn]
  }

  statement {
    sid    = "SQSSendToIngestion"
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [var.ingestion_queue_arn]
  }

  statement {
    sid    = "SQSSendToRetryAndDLQ"
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [
      var.retry_queue_arn,
      var.dlq_arn,
    ]
  }

  statement {
    sid    = "SecretsManagerRead"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = [
      var.db_secret_arn,
      var.openai_secret_arn,
    ]
  }
}

resource "aws_iam_policy" "processor" {
  name        = "${var.project_name}-processor-policy"
  description = "Permissions for Processor Lambda"
  policy      = data.aws_iam_policy_document.processor_permissions.json

  tags = {
    Name = "${var.project_name}-processor-policy"
  }
}

resource "aws_iam_role_policy_attachment" "processor" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.processor.arn
}

# ---------------------------------------------------------------------------
# DLQ Lambda Policy
# ---------------------------------------------------------------------------
# Permissions: Consume from DLQ, read secrets for DB access
data "aws_iam_policy_document" "dlq_permissions" {
  statement {
    sid    = "SQSConsumeDLQ"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [var.dlq_arn]
  }

  statement {
    sid    = "SecretsManagerRead"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = [var.db_secret_arn]
  }
}

resource "aws_iam_policy" "dlq" {
  name        = "${var.project_name}-dlq-policy"
  description = "Permissions for DLQ Lambda"
  policy      = data.aws_iam_policy_document.dlq_permissions.json

  tags = {
    Name = "${var.project_name}-dlq-policy"
  }
}

resource "aws_iam_role_policy_attachment" "dlq" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.dlq.arn
}

# ---------------------------------------------------------------------------
# AI Lambda Policy
# ---------------------------------------------------------------------------
# Permissions: Send to AI job queue, read secrets for DB + OpenAI key access
data "aws_iam_policy_document" "ai_permissions" {
  statement {
    sid    = "SQSSendToAIQueue"
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [var.ai_job_queue_arn]
  }

  statement {
    sid    = "SecretsManagerRead"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = [
      var.db_secret_arn,
      var.openai_secret_arn,
    ]
  }
}

resource "aws_iam_policy" "ai" {
  name        = "${var.project_name}-ai-policy"
  description = "Permissions for AI Lambda"
  policy      = data.aws_iam_policy_document.ai_permissions.json

  tags = {
    Name = "${var.project_name}-ai-policy"
  }
}

resource "aws_iam_role_policy_attachment" "ai" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.ai.arn
}

# ===========================================================================
# Lambda Functions
# ===========================================================================
# All Lambdas share the same code artifact (the compiled NestJS API output at
# apps/api/dist). Each uses a different handler entry point.
#
# We use archive_file to zip the dist directory, mirroring CDK's Code.fromAsset().
# The source path is relative to this module file (terraform/modules/lambdas/).
#
# Common props (matching CDK):
#   - Runtime: Node.js 20.x
#   - Memory: 256MB
#   - Timeout: 30s (AI: 5min)
#   - Tracing: Active (X-Ray)
#   - VPC: Private subnets with egress

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Package the NestJS build output as a zip for Lambda deployment.
# Equivalent to CDK's Code.fromAsset('../apps/api/dist').
data "archive_file" "lambda_code" {
  type        = "zip"
  source_dir  = "${path.module}/../../../apps/api/dist"
  output_path = "${path.module}/lambda.zip"
}

locals {
  common_env = {
    DB_SECRET_ARN             = var.db_secret_arn
    REDIS_URL                 = var.redis_url
    OPENAI_API_KEY_SECRET_ARN = var.openai_secret_arn
  }
}

# ---------------------------------------------------------------------------
# Ingestion Lambda
# ---------------------------------------------------------------------------
# Handles POST /webhooks/{endpointId}. Validates the endpoint exists,
# persists the event to PostgreSQL, publishes to ingestion SQS queue,
# and returns 202 Accepted.
resource "aws_lambda_function" "ingestion" {
  function_name    = "${var.project_name}-ingestion"
  description      = "Webhook ingestion — validates endpoint, persists event, enqueues to SQS"
  handler          = "ingestion.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_code.output_path
  source_code_hash = data.archive_file.lambda_code.output_base64sha256

  role        = aws_iam_role.lambda_execution.arn
  memory_size = 256
  timeout     = 30
  tracing_config {
    mode = "Active"
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = merge(local.common_env, {
      QUEUE_URL = var.ingestion_queue_url
    })
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_base,
    aws_iam_role_policy_attachment.ingestion,
  ]

  tags = {
    Name = "${var.project_name}-ingestion"
  }
}

# ---------------------------------------------------------------------------
# Processor Lambda
# ---------------------------------------------------------------------------
# Triggered by SQS (ingestion queue). Evaluates routing rules, delivers
# the webhook payload to the configured destination, records delivery
# attempts. On failure, schedules retry via BullMQ or promotes to DLQ.
resource "aws_lambda_function" "processor" {
  function_name    = "${var.project_name}-processor"
  description      = "Event processor — delivers webhook payload, handles retries and DLQ promotion"
  handler          = "processor.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_code.output_path
  source_code_hash = data.archive_file.lambda_code.output_base64sha256

  role        = aws_iam_role.lambda_execution.arn
  memory_size = 256
  timeout     = 30
  tracing_config {
    mode = "Active"
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = merge(local.common_env, {
      INGESTION_QUEUE_URL = var.ingestion_queue_url
      RETRY_QUEUE_URL     = var.retry_queue_url
      DLQ_URL             = var.dlq_url
    })
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_base,
    aws_iam_role_policy_attachment.processor,
  ]

  tags = {
    Name = "${var.project_name}-processor"
  }
}

# ---------------------------------------------------------------------------
# DLQ Lambda
# ---------------------------------------------------------------------------
# Triggered by the DLQ SQS queue. Captures full failure context
# (all delivery attempt records, original payload, final error reason)
# and writes a dlq_events row.
resource "aws_lambda_function" "dlq" {
  function_name    = "${var.project_name}-dlq-handler"
  description      = "DLQ handler — captures failure context, writes dlq_events row"
  handler          = "dlq.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_code.output_path
  source_code_hash = data.archive_file.lambda_code.output_base64sha256

  role        = aws_iam_role.lambda_execution.arn
  memory_size = 256
  timeout     = 30
  tracing_config {
    mode = "Active"
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = merge(local.common_env, {
      DLQ_URL = var.dlq_url
    })
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_base,
    aws_iam_role_policy_attachment.dlq,
  ]

  tags = {
    Name = "${var.project_name}-dlq-handler"
  }
}

# ---------------------------------------------------------------------------
# AI Lambda
# ---------------------------------------------------------------------------
# Triggered by EventBridge Scheduler every 30 minutes. Aggregates events
# from the last 24h per endpoint, calls OpenAI gpt-4o-mini to generate
# natural-language summaries, and upserts ai_summaries rows.
# Longer timeout (5 min) because OpenAI API calls may be slow.
resource "aws_lambda_function" "ai" {
  function_name    = "${var.project_name}-ai-worker"
  description      = "AI background worker — generates event summaries and classifies events"
  handler          = "ai.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_code.output_path
  source_code_hash = data.archive_file.lambda_code.output_base64sha256

  role        = aws_iam_role.lambda_execution.arn
  memory_size = 256
  timeout     = 300 # 5 minutes — AI calls may take longer
  tracing_config {
    mode = "Active"
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = merge(local.common_env, {
      AI_JOB_QUEUE_URL = var.ai_job_queue_url
    })
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_base,
    aws_iam_role_policy_attachment.ai,
  ]

  tags = {
    Name = "${var.project_name}-ai-worker"
  }
}

# ---------------------------------------------------------------------------
# Lambda Security Group
# ---------------------------------------------------------------------------
# Lambda functions in the VPC need a security group. Since Lambdas only
# initiate outbound connections (to SQS, RDS, Redis, internet via NAT), we
# keep the default egress-all and don't restrict ingress (nothing connects
# to Lambda directly except via SQS event source mappings or API Gateway).
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg"
  description = "Security group for HookMate Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound traffic (needed for SQS, RDS, Redis, internet)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-lambda-sg"
  }
}

# ===========================================================================
# SQS Event Source Mappings
# ===========================================================================
# In the CDK, SQS-triggered Lambda functions are wired implicitly when the
# SQS queue is created as an event source. In Terraform, we create explicit
# event source mappings.

# Ingestion queue → Processor Lambda (standard SQS trigger)
resource "aws_lambda_event_source_mapping" "processor_trigger" {
  event_source_arn = var.ingestion_queue_arn
  function_name    = aws_lambda_function.processor.arn
  enabled          = true
  batch_size       = 10

  # Standard SQS queues used — no FIFO ordering needed
  # (BullMQ handles per-endpoint ordering via Redis)
}

# DLQ → DLQ Lambda
resource "aws_lambda_event_source_mapping" "dlq_trigger" {
  event_source_arn = var.dlq_arn
  function_name    = aws_lambda_function.dlq.arn
  enabled          = true
  batch_size       = 10
}
