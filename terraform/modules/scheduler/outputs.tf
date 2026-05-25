output "ai_schedule_rule_arn" {
  description = "ARN of the EventBridge rule for AI summary schedule."
  value       = aws_cloudwatch_event_rule.ai_schedule.arn
}

output "ai_schedule_rule_name" {
  description = "Name of the EventBridge rule for AI summary schedule."
  value       = aws_cloudwatch_event_rule.ai_schedule.name
}
