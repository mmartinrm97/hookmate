output "alarm_topic_arn" {
  description = "ARN of the SNS topic for alarm notifications."
  value       = aws_sns_topic.alarms.arn
}

output "alarm_topic_name" {
  description = "Name of the SNS topic for alarm notifications."
  value       = aws_sns_topic.alarms.name
}

output "dashboard_name" {
  description = "Name of the CloudWatch operations dashboard."
  value       = aws_cloudwatch_dashboard.operations.dashboard_name
}
