variable "project_name" {
  description = "Project name for resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the API handler Lambda security group."
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the API handler Lambda."
  type        = list(string)
}

variable "db_secret_arn" {
  description = "ARN of the DB credentials secret."
  type        = string
}

variable "openai_secret_arn" {
  description = "ARN of the OpenAI API key secret."
  type        = string
}

variable "ingestion_lambda_arn" {
  description = "ARN of the Ingestion Lambda function."
  type        = string
}

variable "ingestion_lambda_name" {
  description = "Name of the Ingestion Lambda function."
  type        = string
}
