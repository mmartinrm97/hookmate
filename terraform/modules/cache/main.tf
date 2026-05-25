# ===========================================================================
# Cache Module — ElastiCache Redis 7.0
# ===========================================================================
# Mirrors CacheStack (infrastructure/lib/cache-stack.ts).
#
# Single-node Redis 7.0 on cache.t3.micro. Used by BullMQ for retry job
# scheduling and by the NestJS API for caching. In production, replace with
# a replication group with Multi-AZ.
#
# CDK equivalent:
#   new CfnCacheCluster(this, 'HookMateRedis', {
#     engine: 'redis',
#     cacheNodeType: 'cache.t3.micro',
#     numCacheNodes: 1,
#     engineVersion: '7.0',
#     vpcSecurityGroupIds: [...],
#     cacheSubnetGroupName: subnetGroup.ref,
#     autoMinorVersionUpgrade: true,
#   });
# ===========================================================================

# ---------------------------------------------------------------------------
# Security Group
# ---------------------------------------------------------------------------
# Only allow Redis traffic (6379) from within the VPC's private subnets.
# Mirrors CDK: addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(6379))
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Allow Redis access from private subnets only"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis from VPC private subnets"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # allowAllOutbound: false in CDK — we use default-deny with explicit egress
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

# ---------------------------------------------------------------------------
# Subnet Group
# ---------------------------------------------------------------------------
# ElastiCache requires a subnet group to place the cluster in private subnets.
# Mirrors CDK: CfnSubnetGroup with subnetIds from vpc.privateSubnets.
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.project_name}-redis-subnet-group"
  description = "Subnet group for HookMate ElastiCache Redis"
  subnet_ids  = var.private_subnet_ids
}

# ---------------------------------------------------------------------------
# Redis Cluster
# ---------------------------------------------------------------------------
# Single node, cache.t3.micro. For production, use a replication group with
# --num-cache-nodes (clusters) for sharding and Multi-AZ.
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-redis-${var.environment}"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  auto_minor_version_upgrade = true

  tags = {
    Name = "${var.project_name}-redis"
  }
}
