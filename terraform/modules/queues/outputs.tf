output "dlq_arn" {
  description = "ARN of the dead-letter queue."
  value       = aws_sqs_queue.dlq.arn
}

output "dlq_url" {
  description = "URL of the dead-letter queue."
  value       = aws_sqs_queue.dlq.url
}

output "ingestion_queue_arn" {
  description = "ARN of the ingestion queue."
  value       = aws_sqs_queue.ingestion.arn
}

output "ingestion_queue_url" {
  description = "URL of the ingestion queue."
  value       = aws_sqs_queue.ingestion.url
}

output "retry_queue_arn" {
  description = "ARN of the retry queue."
  value       = aws_sqs_queue.retry.arn
}

output "retry_queue_url" {
  description = "URL of the retry queue."
  value       = aws_sqs_queue.retry.url
}

output "ai_job_queue_arn" {
  description = "ARN of the AI job queue."
  value       = aws_sqs_queue.ai_jobs.arn
}

output "ai_job_queue_url" {
  description = "URL of the AI job queue."
  value       = aws_sqs_queue.ai_jobs.url
}
