# ---------------------------------------------------------------------------
# Root-level outputs — aggregate key ARNs and URLs from all modules.
# ---------------------------------------------------------------------------

output "project_name" {
  description = "Terraform bootstrap project name."
  value       = local.project_name
}

output "aws_region" {
  description = "Target AWS region."
  value       = var.aws_region
}

# -- VPC --
output "vpc_id" {
  description = "HookMate VPC ID."
  value       = module.vpc.vpc_id
}

# -- Database --
output "db_endpoint" {
  description = "RDS PostgreSQL endpoint address."
  value       = module.database.db_endpoint
}

output "db_port" {
  description = "RDS PostgreSQL port."
  value       = module.database.db_port
}

output "db_secret_arn" {
  description = "Secrets Manager ARN for DB credentials."
  value       = module.database.db_secret_arn
}

# -- Cache --
output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint."
  value       = module.cache.cache_endpoint
}

output "redis_port" {
  description = "ElastiCache Redis port."
  value       = module.cache.cache_port
}

output "redis_url" {
  description = "Redis connection URL (for BullMQ)."
  value       = "redis://${module.cache.cache_endpoint}:${module.cache.cache_port}"
}

# -- Queues --
output "ingestion_queue_url" {
  description = "Ingestion queue URL."
  value       = module.queues.ingestion_queue_url
}

output "dlq_url" {
  description = "Dead-letter queue URL."
  value       = module.queues.dlq_url
}

output "retry_queue_url" {
  description = "Retry queue URL."
  value       = module.queues.retry_queue_url
}

output "ai_job_queue_url" {
  description = "AI job queue URL."
  value       = module.queues.ai_job_queue_url
}

# -- Lambdas --
output "ingestion_function_arn" {
  description = "Ingestion Lambda ARN."
  value       = module.lambdas.ingestion_lambda_arn
}

output "processor_function_arn" {
  description = "Processor Lambda ARN."
  value       = module.lambdas.processor_lambda_arn
}

output "dlq_function_arn" {
  description = "DLQ Lambda ARN."
  value       = module.lambdas.dlq_lambda_arn
}

output "ai_function_arn" {
  description = "AI Lambda ARN."
  value       = module.lambdas.ai_lambda_arn
}

# -- API Gateway --
output "http_api_url" {
  description = "HTTP API endpoint URL."
  value       = module.api_gateway.http_api_url
}

output "api_handler_function_arn" {
  description = "NestJS API handler Lambda ARN."
  value       = module.api_gateway.api_handler_lambda_arn
}

# -- Scheduler --
output "ai_schedule_rule_arn" {
  description = "EventBridge rule ARN for AI summary schedule."
  value       = module.scheduler.ai_schedule_rule_arn
}

# -- Monitoring --
output "alarm_topic_arn" {
  description = "SNS topic ARN for alarm notifications."
  value       = module.monitoring.alarm_topic_arn
}

output "dashboard_name" {
  description = "CloudWatch dashboard name."
  value       = module.monitoring.dashboard_name
}

# -- Frontend --
output "dashboard_bucket_name" {
  description = "S3 bucket name for dashboard static assets."
  value       = module.frontend.dashboard_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = module.frontend.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = module.frontend.cloudfront_domain_name
}
