# ---------------------------------------------------------------------------
# Input variables for HookMate Terraform mirror.
# These match the configurable values used in the CDK stacks.
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, production)."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Matches CDK: IpAddresses.cidr('10.0.0.0/16')."
  type        = string
  default     = "10.0.0.0/16"
}

# ---------------------------------------------------------------------------
# Secrets ARNs (must be created before terraform apply)
# ---------------------------------------------------------------------------
# The OpenAI API key secret must be created manually post-deploy:
#   aws secretsmanager create-secret \
#     --name hookmate/openai_api_key \
#     --secret-string "<your-openai-key>"
# This mirrors the CDK pattern: Secret.fromSecretNameV2(this, 'OpenAIAPIKey', 'hookmate/openai_api_key')

variable "openai_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the OpenAI API key (hookmate/openai_api_key)."
  type        = string
  default     = "arn:aws:secretsmanager:us-east-1:000000000000:secret:hookmate/openai_api_key-XXXXXX"
}
