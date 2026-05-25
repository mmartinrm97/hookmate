# ===========================================================================
# Monitoring Module — CloudWatch Dashboard + Alarms + SNS
# ===========================================================================
# Mirrors MonitoringStack (infrastructure/lib/monitoring-stack.ts).
#
# Creates:
#   1. SNS topic for alarm notifications
#   2. CloudWatch dashboard named "HookMate-Operations" (per spec)
#   3. 5 CloudWatch alarms with SNS actions
# ===========================================================================

# ---------------------------------------------------------------------------
# SNS Topic for Alarm Notifications
# ---------------------------------------------------------------------------
# All alarms publish to this SNS topic. In production, subscribe Slack/Discord
# endpoints via additional resources or manual console configuration.
# Mirrors CDK: new Topic(this, 'HookMateAlarmTopic', { topicName: 'hookmate-alarms' })
resource "aws_sns_topic" "alarms" {
  name         = "${var.project_name}-alarms"
  display_name = "HookMate Operational Alarms"

  tags = {
    Name = "${var.project_name}-alarms"
  }
}

# ===========================================================================
# CloudWatch Dashboard
# ===========================================================================
# Named "HookMate-Operations" per spec section 11.3. Contains 5 widgets:
#   1. Queue Depth (graph — all 4 queues)
#   2. Lambda Error Rate (graph — aggregate across all functions)
#   3. RDS CPU (single-value widget)
#   4. DLQ Depth (single-value widget)
#   5. Cold Starts (log query widget)

locals {
  dashboard_body = jsonencode({
    widgets = [
      # Widget 1: Queue Depth
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Queue Depth"
          view    = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-dlq", { stat = "Sum", label = "DLQ" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-ingestion", { stat = "Sum", label = "Ingestion" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-retry", { stat = "Sum", label = "Retry" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-ai-jobs", { stat = "Sum", label = "AI Jobs" }],
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
        }
      },
      # Widget 2: Lambda Error Rate
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Error Rate"
          view    = "timeSeries"
          stacked = false
          metrics = [
            [{ expression = "IF(m1 == 0, 0, m2 / m1) * 100", label = "Error Rate %", id = "e1" }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-ingestion", { stat = "Sum", id = "i1", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-processor", { stat = "Sum", id = "i2", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-dlq-handler", { stat = "Sum", id = "i3", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-ai-worker", { stat = "Sum", id = "i4", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-api-handler", { stat = "Sum", id = "i5", visible = false }],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-ingestion", { stat = "Sum", id = "e1", visible = false }],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-processor", { stat = "Sum", id = "e2", visible = false }],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-dlq-handler", { stat = "Sum", id = "e3", visible = false }],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-ai-worker", { stat = "Sum", id = "e4", visible = false }],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-api-handler", { stat = "Sum", id = "e5", visible = false }],
            [{ expression = "i1 + i2 + i3 + i4 + i5", label = "Total Invocations", id = "m1", visible = false }],
            [{ expression = "e1 + e2 + e3 + e4 + e5", label = "Total Errors", id = "m2", visible = false }],
          ]
          period = 300
          region = data.aws_region.current.name
        }
      },
      # Widget 3: RDS CPU
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 6
        height = 6
        properties = {
          title = "RDS CPU"
          view  = "singleValue"
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.db_instance_id],
          ]
          region = data.aws_region.current.name
        }
      },
      # Widget 4: DLQ Depth (prominent)
      {
        type   = "metric"
        x      = 6
        y      = 6
        width  = 6
        height = 6
        properties = {
          title = "DLQ Depth"
          view  = "singleValue"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-dlq", { stat = "Sum" }],
          ]
          region = data.aws_region.current.name
        }
      },
      # Widget 5: Cold Starts
      {
        type   = "log"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Cold Starts"
          region = data.aws_region.current.name
          query  = "SOURCE '/aws/lambda/${var.project_name}-ingestion' | SOURCE '/aws/lambda/${var.project_name}-processor' | SOURCE '/aws/lambda/${var.project_name}-dlq-handler' | SOURCE '/aws/lambda/${var.project_name}-ai-worker' | SOURCE '/aws/lambda/${var.project_name}-api-handler'\n| fields @timestamp, @message\n| filter @type = \"REPORT\"\n| filter @initDuration > 0\n| stats count() by function_name"
        }
      },
    ]
  })
}

resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = "${var.project_name}-operations"
  dashboard_body = local.dashboard_body
}

# ===========================================================================
# CloudWatch Alarms
# ===========================================================================
# 5 alarms per spec section 11.4 and CDK MonitoringStack.

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# 1. DLQ Depth > 100
# ---------------------------------------------------------------------------
# Alerts when the dead-letter queue has more than 100 messages, indicating
# systematic delivery failures that need operator attention.
resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "${var.project_name}-dlq-depth"
  alarm_description   = "Alert when DLQ has more than 100 messages — investigate failed events"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 100
  treat_missing_data  = "notBreaching"

  metric_name = "ApproximateNumberOfMessagesVisible"
  namespace   = "AWS/SQS"
  statistic   = "Sum"
  period      = 300

  dimensions = {
    QueueName = "${var.project_name}-dlq"
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
}

# ---------------------------------------------------------------------------
# 2. Lambda Aggregate Error Rate > 5%
# ---------------------------------------------------------------------------
# CDK uses a MathExpression metric combining all 5 Lambda functions.
# In Terraform, the same approach uses a metric math expression alarm or
# a composite approach. Here we use a simpler per-Lambda approach:
# we create a metric math alarm.
#
# Note: Terraform does not support MathExpression as an alarm metric source
# directly. Instead, we create a metric_widget for the dashboard (above)
# and use an approximate approach for the alarm: alarm on any one function
# exceeding 5% error rate. In production, you'd use CloudWatch Metrics
# Insights or a custom metric for precise aggregate error rates.
#
# Mirroring CDK's approach more closely: we highlight the DLQ alarm as the
# primary indicator of processing failures. The Lambda error alarm watches
# the aggregate via a composite approach.

# Approach: Use metric_query blocks to compute aggregate error rate across all 5
# Lambda functions. This mirrors the CDK MathExpression: IF(m1 == 0, 0, m2 / m1) * 100
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  alarm_name          = "${var.project_name}-lambda-error-rate"
  alarm_description   = "Alert when aggregate Lambda error rate exceeds 5% over 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 5
  treat_missing_data  = "notBreaching"

  # Metric math expression: (TotalErrors / TotalInvocations) * 100
  metric_query {
    id          = "error_rate"
    expression  = "100 * m2 / m1"
    label       = "Error Rate %"
    return_data = true
  }

  metric_query {
    id         = "m1"
    expression = "i1 + i2 + i3 + i4 + i5"
    label      = "Total Invocations"
  }

  metric_query {
    id         = "m2"
    expression = "e1 + e2 + e3 + e4 + e5"
    label      = "Total Errors"
  }

  metric_query {
    id = "i1"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-ingestion" }
    }
  }

  metric_query {
    id = "i2"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-processor" }
    }
  }

  metric_query {
    id = "i3"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-dlq-handler" }
    }
  }

  metric_query {
    id = "i4"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-ai-worker" }
    }
  }

  metric_query {
    id = "i5"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-api-handler" }
    }
  }

  metric_query {
    id = "e1"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-ingestion" }
    }
  }

  metric_query {
    id = "e2"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-processor" }
    }
  }

  metric_query {
    id = "e3"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-dlq-handler" }
    }
  }

  metric_query {
    id = "e4"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-ai-worker" }
    }
  }

  metric_query {
    id = "e5"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${var.project_name}-api-handler" }
    }
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
}

# ---------------------------------------------------------------------------
# 3. RDS CPU > 80% for 10 minutes
# ---------------------------------------------------------------------------
# Evaluation periods: 2 × 5min = 10 minutes (mirrors CDK)
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project_name}-rds-cpu"
  alarm_description   = "Alert when RDS CPU exceeds 80% for 10 minutes — consider scaling up"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 80
  treat_missing_data  = "notBreaching"

  metric_name = "CPUUtilization"
  namespace   = "AWS/RDS"
  statistic   = "Average"
  period      = 300

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
}

# ---------------------------------------------------------------------------
# 4. API Gateway 5xx Rate > 1%
# ---------------------------------------------------------------------------
# Alerts on excessive server errors from the HTTP API Gateway.
resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "${var.project_name}-api-5xx-rate"
  alarm_description   = "Alert when API Gateway 5xx error rate exceeds 1% over 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 1
  treat_missing_data  = "notBreaching"

  # Metric math: (5xx / Count) * 100
  metric_query {
    id          = "error_rate"
    expression  = "100 * m2 / m1"
    label       = "API Gateway 5XX Rate %"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "Count"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiId = var.http_api_id }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "5XX"
      namespace   = "AWS/ApiGateway"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiId = var.http_api_id }
    }
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
}

# ---------------------------------------------------------------------------
# 5. ElastiCache CPU > 80%
# ---------------------------------------------------------------------------
# Evaluation periods: 2 (mirrors CDK)
resource "aws_cloudwatch_metric_alarm" "cache_cpu" {
  alarm_name          = "${var.project_name}-elasticache-cpu"
  alarm_description   = "Alert when ElastiCache Redis CPU exceeds 80% — consider scaling up"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 80
  treat_missing_data  = "notBreaching"

  metric_name = "CPUUtilization"
  namespace   = "AWS/ElastiCache"
  statistic   = "Average"
  period      = 300

  dimensions = {
    CacheClusterId = var.cache_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
}
