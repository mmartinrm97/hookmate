# ---------------------------------------------------------------------------
# AWS Provider configuration for HookMate Terraform mirror.
# Matches the provider setup used by AWS CDK in infrastructure/lib/.
# ---------------------------------------------------------------------------

provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources that support tagging.
  # Individual modules may add more specific tags.
  default_tags {
    tags = {
      Project     = local.project_name
      Environment = local.environment
      ManagedBy   = "terraform"
    }
  }
}
