output "project_name" {
  description = "Terraform bootstrap project name."
  value       = local.project_name
}

output "aws_region" {
  description = "Terraform bootstrap region."
  value       = var.aws_region
}
