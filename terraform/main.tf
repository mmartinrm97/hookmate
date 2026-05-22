provider "aws" {
  region = var.aws_region
}

locals {
  project_name = "hookmate"
  environment  = "bootstrap"
}
