# ===========================================================================
# Scheduler Module — EventBridge Rule for AI Summary Trigger
# ===========================================================================
# Mirrors SchedulerStack (infrastructure/lib/scheduler-stack.ts).
#
# Creates an EventBridge rule that fires every 30 minutes to trigger the
# AI Lambda for summary generation and event classification.
#
# CDK equivalent:
#   new Rule(this, 'AiSummarySchedule', {
#     schedule: Schedule.expression('cron(*/30 * * * ? *)'),
#     targets: [new LambdaFunction(aiLambda, { event: { jobType: 'generate-summary' } })],
#   });
# ===========================================================================

# ---------------------------------------------------------------------------
# EventBridge Rule
# ---------------------------------------------------------------------------
# Fires every 30 minutes to trigger the AI summary generation job.
# The AI Lambda aggregates events from the last 24h per endpoint,
# calls OpenAI gpt-4o-mini, and writes summaries to ai_summaries.
resource "aws_cloudwatch_event_rule" "ai_schedule" {
  name                = "${var.project_name}-ai-summary-trigger"
  description         = "Triggers AI summary generation every 30 minutes"
  schedule_expression = "cron(*/30 * * * ? *)"
  state               = "ENABLED"

  tags = {
    Name = "${var.project_name}-ai-summary-trigger"
  }
}

# ---------------------------------------------------------------------------
# Event Target → AI Lambda
# ---------------------------------------------------------------------------
# Sends a static JSON payload with jobType: 'generate-summary' so the AI
# Lambda knows what to do (same as CDK: RuleTargetInput.fromObject(...)).
resource "aws_cloudwatch_event_target" "ai_lambda" {
  rule      = aws_cloudwatch_event_rule.ai_schedule.name
  target_id = "AiLambdaTarget"
  arn       = var.ai_lambda_arn

  input = jsonencode({
    jobType = "generate-summary"
  })
}

# ---------------------------------------------------------------------------
# Lambda Permission for EventBridge
# ---------------------------------------------------------------------------
# Allow EventBridge to invoke the AI Lambda. This mirrors the automatic
# permission grant that CDK's LambdaFunction target performs.
resource "aws_lambda_permission" "eventbridge_ai" {
  statement_id  = "AllowEventBridgeInvokeAiLambda"
  action        = "lambda:InvokeFunction"
  function_name = var.ai_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ai_schedule.arn
}
