# ---------------------------------------------------------------------------
# Terraform version and provider requirements.
# ---------------------------------------------------------------------------
# NOTE: Before running `terraform init`, create these resources manually:
#   aws s3api create-bucket --bucket hookmate-terraform-state --region us-east-1
#   aws s3api put-bucket-versioning \
#     --bucket hookmate-terraform-state \
#     --versioning-configuration Status=Enabled
#   aws dynamodb create-table \
#     --table-name hookmate-terraform-locks \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region us-east-1
#
# CDK handles state management implicitly via CloudFormation (S3 bucket managed
# by `cdk bootstrap`). Terraform requires explicit backend configuration — this
# is a key architectural difference highlighted in COMPARISON.md.
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {
    bucket         = "hookmate-terraform-state"
    key            = "hookmate/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "hookmate-terraform-locks"
    encrypt        = true
  }
}
