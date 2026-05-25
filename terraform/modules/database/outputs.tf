output "db_endpoint" {
  description = "RDS PostgreSQL endpoint address."
  value       = aws_db_instance.hookmate.address
}

output "db_port" {
  description = "RDS PostgreSQL port."
  value       = aws_db_instance.hookmate.port
}

output "db_instance_id" {
  description = "RDS instance identifier (used for CloudWatch metrics)."
  value       = aws_db_instance.hookmate.id
}

output "db_secret_arn" {
  description = "Secrets Manager ARN for DB credentials."
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_security_group_id" {
  description = "Security group ID for RDS."
  value       = aws_security_group.rds.id
}
