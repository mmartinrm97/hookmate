variable "project_name" {
  description = "Project name for resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

# Queue ARNs (for metric dimensions and references)
variable "ingestion_queue_arn" {
  description = "ARN of the ingestion queue."
  type        = string
}

variable "dlq_arn" {
  description = "ARN of the dead-letter queue."
  type        = string
}

variable "retry_queue_arn" {
  description = "ARN of the retry queue."
  type        = string
}

variable "ai_job_queue_arn" {
  description = "ARN of the AI job queue."
  type        = string
}

# Lambda ARNs (for error rate computation)
variable "ingestion_lambda_arn" {
  description = "ARN of the Ingestion Lambda."
  type        = string
}

variable "processor_lambda_arn" {
  description = "ARN of the Processor Lambda."
  type        = string
}

variable "dlq_lambda_arn" {
  description = "ARN of the DLQ Lambda."
  type        = string
}

variable "ai_lambda_arn" {
  description = "ARN of the AI Lambda."
  type        = string
}

variable "api_handler_lambda_arn" {
  description = "ARN of the API handler Lambda."
  type        = string
}

# Instance identifiers for dimension-based metrics
variable "db_instance_id" {
  description = "RDS DB instance identifier (for CPU metrics)."
  type        = string
}

variable "cache_cluster_id" {
  description = "ElastiCache cluster ID (for CPU metrics)."
  type        = string
}

variable "http_api_id" {
  description = "API Gateway HTTP API ID (for 5xx metrics)."
  type        = string
}
