output "cache_endpoint" {
  description = "ElastiCache Redis primary endpoint address."
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "cache_port" {
  description = "ElastiCache Redis port."
  value       = aws_elasticache_cluster.redis.cache_nodes[0].port
}

output "cache_cluster_id" {
  description = "ElastiCache cluster ID (used for CloudWatch metrics)."
  value       = aws_elasticache_cluster.redis.id
}

output "cache_security_group_id" {
  description = "Security group ID for ElastiCache Redis."
  value       = aws_security_group.redis.id
}
