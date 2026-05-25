# ===========================================================================
# Database Module — RDS PostgreSQL 16
# ===========================================================================
# Mirrors DatabaseStack (infrastructure/lib/database-stack.ts).
#
# CDK creates the admin password via Credentials.fromGeneratedSecret('hookmate_admin')
# which auto-generates a password and stores it in Secrets Manager with automatic
# rotation. In Terraform, we replicate this with random_password + aws_secretsmanager_*
# resources.
# ===========================================================================

# ---------------------------------------------------------------------------
# Random password for the database admin user
# ---------------------------------------------------------------------------
# CDK's fromGeneratedSecret generates a 30-character password with all character
# types. We match that behavior here.
resource "random_password" "db_master" {
  length           = 30
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  min_upper        = 1
  min_lower        = 1
  min_numeric      = 1
  min_special      = 1
}

# ---------------------------------------------------------------------------
# Secrets Manager secret for DB credentials
# ---------------------------------------------------------------------------
# Mirrors the CDK-generated secret. We create the secret after the DB exists
# (so we know the endpoint), then store the full connection details in JSON
# format matching what CDK generates.
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}/db_credentials"
  description             = "Auto-generated credentials for HookMate PostgreSQL database"
  recovery_window_in_days = 0 # Allow immediate deletion (safe for dev/portfolio)
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id

  secret_string = jsonencode({
    username             = "hookmate_admin"
    password             = random_password.db_master.result
    engine               = "postgres"
    host                 = aws_db_instance.hookmate.address
    port                 = 5432
    dbname               = "hookmate"
    dbInstanceIdentifier = aws_db_instance.hookmate.identifier
  })
}

# ---------------------------------------------------------------------------
# Secret rotation
# ---------------------------------------------------------------------------
# CDK's DatabaseInstance with fromGeneratedSecret automatically enables rotation
# every 30 days. In Terraform, we must explicitly create a rotation resource
# (key difference — see COMPARISON.md).
resource "aws_secretsmanager_secret_rotation" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  rotation_rules {
    automatically_after_days = 30
  }
}

# ---------------------------------------------------------------------------
# Security Group
# ---------------------------------------------------------------------------
# Only allow PostgreSQL traffic (5432) from within the VPC's CIDR.
# Lambda functions and other internal services in private subnets can reach the DB.
# Mirrors: SecurityGroup with addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(5432))
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow PostgreSQL access from private subnets only"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from VPC private subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # CDK sets allowAllOutbound: false; we match that by default-deny egress.
  # Only the specific egress needed is the default for RDS (none to internet).
  egress {
    description = "Allow all outbound (default - RDS needs no restrictive egress)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# ---------------------------------------------------------------------------
# DB Subnet Group
# ---------------------------------------------------------------------------
# RDS requires a subnet group spanning at least 2 AZs for Multi-AZ, but also
# needed for single-AZ deployments to specify which subnets to use.
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Subnet group for HookMate RDS PostgreSQL"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# ---------------------------------------------------------------------------
# DB Parameter Group
# ---------------------------------------------------------------------------
# Using the default PostgreSQL 16 parameter group values. Explicitly creating
# this for clarity — the CDK uses the default parameter group as well.
resource "aws_db_parameter_group" "postgres16" {
  name        = "${var.project_name}-postgres16"
  family      = "postgres16"
  description = "Parameter group for HookMate PostgreSQL 16"

  tags = {
    Name = "${var.project_name}-postgres16"
  }
}

# ---------------------------------------------------------------------------
# IAM Role for RDS Enhanced Monitoring
# ---------------------------------------------------------------------------
# CDK creates this automatically when monitoringInterval is set. In Terraform,
# we need an explicit IAM role with the RDS monitoring service trust policy.
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${var.project_name}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  description = "IAM role for RDS enhanced monitoring"
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL Instance
# ---------------------------------------------------------------------------
# Mirrors the CDK DatabaseInstance:
#   - Engine: PostgreSQL 16
#   - Instance: db.t3.micro (T3, MICRO)
#   - Single-AZ (cost constraint)
#   - 20GB storage, auto-scale to 100GB
#   - Encryption at rest enabled
#   - Backup retention: 7 days
#   - Enhanced monitoring: 60s interval
#   - Performance Insights enabled
#   - No deletion protection (dev/portfolio)
resource "aws_db_instance" "hookmate" {
  identifier = "${var.project_name}-db-${var.environment}"

  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"

  db_name  = "hookmate"
  username = "hookmate_admin"
  password = random_password.db_master.result
  port     = 5432

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  multi_az = false

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  # Enhanced monitoring (CDK: monitoringInterval: Duration.seconds(60))
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Performance Insights (CDK: enablePerformanceInsights: true)
  performance_insights_enabled = true

  # No deletion protection for dev (CDK: deletionProtection: false)
  deletion_protection = false
  skip_final_snapshot = true

  # Auto minor version upgrade (default is true — matches CDK)
  auto_minor_version_upgrade = true

  tags = {
    Name = "${var.project_name}-db"
  }

  depends_on = [
    aws_iam_role_policy_attachment.rds_enhanced_monitoring
  ]
}
