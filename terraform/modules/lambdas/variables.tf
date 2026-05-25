variable "project_name" {
  description = "Project name for resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for Lambda security group and VPC config."
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Lambda VPC placement."
  type        = list(string)
}

variable "db_secret_arn" {
  description = "ARN of the Secrets Manager secret for DB credentials."
  type        = string
}

variable "redis_url" {
  description = "Redis connection URL (redis://host:port)."
  type        = string
}

variable "openai_secret_arn" {
  description = "ARN of the Secrets Manager secret for the OpenAI API key."
  type        = string
}

# Queue ARNs and URLs
variable "ingestion_queue_arn" {
  description = "ARN of the ingestion SQS queue."
  type        = string
}

variable "ingestion_queue_url" {
  description = "URL of the ingestion SQS queue."
  type        = string
}

variable "retry_queue_arn" {
  description = "ARN of the retry SQS queue."
  type        = string
}

variable "retry_queue_url" {
  description = "URL of the retry SQS queue."
  type        = string
}

variable "dlq_arn" {
  description = "ARN of the dead-letter SQS queue."
  type        = string
}

variable "dlq_url" {
  description = "URL of the dead-letter SQS queue."
  type        = string
}

variable "ai_job_queue_arn" {
  description = "ARN of the AI job SQS queue."
  type        = string
}

variable "ai_job_queue_url" {
  description = "URL of the AI job SQS queue."
  type        = string
}
