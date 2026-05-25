variable "project_name" {
  description = "Project name for resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "ai_lambda_arn" {
  description = "ARN of the AI Lambda function to invoke."
  type        = string
}

variable "ai_lambda_name" {
  description = "Name of the AI Lambda function."
  type        = string
}
