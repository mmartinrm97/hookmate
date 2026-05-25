# ===========================================================================
# API Gateway Module — HTTP API + NestJS Handler
# ===========================================================================
# Mirrors ApiStack (infrastructure/lib/api-stack.ts).
#
# Creates:
#   1. NestJS API handler Lambda (management API routes)
#   2. HTTP API Gateway (v2) with CORS
#   3. Route: POST /webhooks/{endpointId} → Ingestion Lambda
#   4. Route: ANY /{proxy+} → NestJS API handler Lambda
# ===========================================================================

# ---------------------------------------------------------------------------
# NestJS API Handler Lambda
# ---------------------------------------------------------------------------
# Runs the compiled NestJS application (aws-serverless-express).
# Serves all management API routes (endpoints CRUD, event log, DLQ controls, etc.)
data "archive_file" "api_lambda_code" {
  type        = "zip"
  source_dir  = "${path.module}/../../../apps/api/dist"
  output_path = "${path.module}/api-lambda.zip"
}

resource "aws_lambda_function" "api_handler" {
  function_name    = "${var.project_name}-api-handler"
  description      = "NestJS API handler — serves all management API routes"
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.api_lambda_code.output_path
  source_code_hash = data.archive_file.api_lambda_code.output_base64sha256

  role        = aws_iam_role.api_handler.arn
  memory_size = 256
  timeout     = 30
  tracing_config {
    mode = "Active"
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.api_handler.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN             = var.db_secret_arn
      OPENAI_API_KEY_SECRET_ARN = var.openai_secret_arn
      NODE_ENV                  = "production"
    }
  }

  tags = {
    Name = "${var.project_name}-api-handler"
  }
}

# ---------------------------------------------------------------------------
# IAM Role and Policy for API Handler Lambda
# ---------------------------------------------------------------------------
# Permissions: Read DB secret, read OpenAI API key secret
resource "aws_iam_role" "api_handler" {
  name = "${var.project_name}-api-handler-role"

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

  description = "Execution role for NestJS API handler Lambda"

  tags = {
    Name = "${var.project_name}-api-handler-role"
  }
}

# Base policy (logs, X-Ray, VPC)
data "aws_iam_policy_document" "api_handler_base" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-api-handler:*",
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

resource "aws_iam_policy" "api_handler" {
  name        = "${var.project_name}-api-handler-policy"
  description = "Permissions for NestJS API handler Lambda"
  policy      = data.aws_iam_policy_document.api_handler_base.json

  tags = {
    Name = "${var.project_name}-api-handler-policy"
  }
}

resource "aws_iam_role_policy_attachment" "api_handler" {
  role       = aws_iam_role.api_handler.name
  policy_arn = aws_iam_policy.api_handler.arn
}

# ---------------------------------------------------------------------------
# Security Group for API Handler Lambda
# ---------------------------------------------------------------------------
resource "aws_security_group" "api_handler" {
  name        = "${var.project_name}-api-handler-sg"
  description = "Security group for NestJS API handler Lambda"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-api-handler-sg"
  }
}

# ===========================================================================
# HTTP API Gateway (v2)
# ===========================================================================
# HTTP API (v2) — lower cost and latency than REST API (v1).
# CORS enabled for the React dashboard (any origin for dev; restrict in prod).

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project_name}-api"
  description   = "HookMate HTTP API — webhook ingestion and management"
  protocol_type = "HTTP"

  # CORS preflight configuration (mirrors CDK CorsPreflight options)
  cors_configuration {
    allow_headers = [
      "Content-Type",
      "Authorization",
      "X-Amz-Date",
      "X-Api-Key",
      "X-Amz-Security-Token",
    ]
    allow_methods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ]
    allow_origins = ["*"]
    max_age       = 86400 # 1 day
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

# ---------------------------------------------------------------------------
# Stage
# ---------------------------------------------------------------------------
# CDK HTTP API creates a $default stage automatically. We mirror that.
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------

# Integration: POST /webhooks/{endpointId} → Ingestion Lambda
resource "aws_apigatewayv2_integration" "ingestion" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.ingestion_lambda_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Integration: ANY /{proxy+} → NestJS API handler Lambda
resource "aws_apigatewayv2_integration" "api_proxy" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_handler.arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

# Route: POST /webhooks/{endpointId} → Ingestion Lambda
resource "aws_apigatewayv2_route" "webhook_ingest" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /webhooks/{endpointId}"
  target    = "integrations/${aws_apigatewayv2_integration.ingestion.id}"
}

# Route: ANY /{proxy+} → NestJS API handler (catches all management routes)
resource "aws_apigatewayv2_route" "api_proxy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api_proxy.id}"
}

# ---------------------------------------------------------------------------
# Lambda Permissions for API Gateway Invocation
# ---------------------------------------------------------------------------
# Allow API Gateway to invoke both Lambda functions.

resource "aws_lambda_permission" "ingestion_api_gw" {
  statement_id  = "AllowAPIGatewayInvokeIngestion"
  action        = "lambda:InvokeFunction"
  function_name = var.ingestion_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/webhooks/*"
}

resource "aws_lambda_permission" "api_handler_gw" {
  statement_id  = "AllowAPIGatewayInvokeApiHandler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
