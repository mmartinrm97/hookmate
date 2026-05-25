# ===========================================================================
# HookMate — Terraform Mirror (Phase H)
# ===========================================================================
# This configuration mirrors the AWS CDK infrastructure defined in
# infrastructure/lib/. Each module corresponds to a CDK stack.
#
# Deploy order (same as hookmate-app-stack.ts):
#   1. VPC         (no dependencies)
#   2. Queues      (no dependencies)
#   3. Frontend    (no dependencies)
#   4. Database    (depends on VPC)
#   5. Cache       (depends on VPC)
#   6. Lambdas     (depends on Database, Cache, Queues)
#   7. API Gateway (depends on Lambdas, Database)
#   8. Scheduler   (depends on Lambdas)
#   9. Monitoring  (depends on all)
# ===========================================================================

locals {
  project_name = "hookmate"
  environment  = var.environment
}

# ===========================================================================
# 1. Shared VPC
# ===========================================================================
# The CDK creates the VPC inline in HookMateAppStack using aws-cdk-lib/aws-ec2.Vpc.
# This Terraform module mirrors exactly: 10.0.0.0/16, 2 AZs, public + private
# subnets (/24 each), 1 NAT Gateway for cost optimization.
module "vpc" {
  source = "./modules/vpc"

  project_name = local.project_name
  environment  = local.environment
  vpc_cidr     = var.vpc_cidr
}

# ===========================================================================
# 2. SQS Queues
# ===========================================================================
# Mirrors QueueStack — ingestion queue (with DLQ, maxReceiveCount=3),
# retry queue (with DLQ, maxReceiveCount=5), and AI job queue.
# Queues have no VPC dependency and can be created first.
module "queues" {
  source = "./modules/queues"

  project_name = local.project_name
  environment  = local.environment
}

# ===========================================================================
# 3. Frontend (S3 + CloudFront)
# ===========================================================================
# Mirrors FrontendStack — S3 bucket for the React dashboard, CloudFront
# distribution with OAI for secure delivery. No VPC dependency.
module "frontend" {
  source = "./modules/frontend"

  project_name = local.project_name
  environment  = local.environment
}

# ===========================================================================
# 4. RDS PostgreSQL Database
# ===========================================================================
# Mirrors DatabaseStack — PostgreSQL 16 on t3.micro, single-AZ, 20GB storage
# with autoscaling to 100GB. Auto-generated admin credentials stored in
# Secrets Manager. Enhanced monitoring enabled.
module "database" {
  source = "./modules/database"

  project_name       = local.project_name
  environment        = local.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr           = module.vpc.vpc_cidr_block
  private_subnet_ids = module.vpc.private_subnet_ids
}

# ===========================================================================
# 5. ElastiCache Redis
# ===========================================================================
# Mirrors CacheStack — single-node Redis 7.0 on cache.t3.micro, placed in
# private subnets via a subnet group. Used by BullMQ for retry scheduling.
module "cache" {
  source = "./modules/cache"

  project_name       = local.project_name
  environment        = local.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr           = module.vpc.vpc_cidr_block
  private_subnet_ids = module.vpc.private_subnet_ids
}

# ===========================================================================
# 6. Lambda Functions
# ===========================================================================
# Mirrors ComputeStack — 4 Lambda functions (Ingestion, Processor, DLQ, AI).
# Each gets its own IAM role with least-privilege permissions (see the spec
# section 12.2 for the exact permission matrix).
module "lambdas" {
  source = "./modules/lambdas"

  project_name       = local.project_name
  environment        = local.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  db_secret_arn     = module.database.db_secret_arn
  redis_url         = "redis://${module.cache.cache_endpoint}:${module.cache.cache_port}"
  openai_secret_arn = var.openai_secret_arn

  ingestion_queue_arn = module.queues.ingestion_queue_arn
  ingestion_queue_url = module.queues.ingestion_queue_url
  retry_queue_arn     = module.queues.retry_queue_arn
  retry_queue_url     = module.queues.retry_queue_url
  dlq_arn             = module.queues.dlq_arn
  dlq_url             = module.queues.dlq_url
  ai_job_queue_arn    = module.queues.ai_job_queue_arn
  ai_job_queue_url    = module.queues.ai_job_queue_url
}

# ===========================================================================
# 7. API Gateway + NestJS API Handler
# ===========================================================================
# Mirrors ApiStack — HTTP API Gateway (v2) with CORS, two routes:
#   - POST /webhooks/{endpointId} → Ingestion Lambda
#   - ANY /{proxy+} → NestJS API handler Lambda (aws-serverless-express)
module "api_gateway" {
  source = "./modules/api_gateway"

  project_name          = local.project_name
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  db_secret_arn         = module.database.db_secret_arn
  openai_secret_arn     = var.openai_secret_arn
  ingestion_lambda_arn  = module.lambdas.ingestion_lambda_arn
  ingestion_lambda_name = module.lambdas.ingestion_lambda_name
}

# ===========================================================================
# 8. EventBridge Scheduler
# ===========================================================================
# Mirrors SchedulerStack — EventBridge rule that triggers the AI Lambda
# every 30 minutes to generate event summaries and classifications.
module "scheduler" {
  source = "./modules/scheduler"

  project_name   = local.project_name
  environment    = local.environment
  ai_lambda_arn  = module.lambdas.ai_lambda_arn
  ai_lambda_name = module.lambdas.ai_lambda_name
}

# ===========================================================================
# 9. Monitoring (CloudWatch + SNS)
# ===========================================================================
# Mirrors MonitoringStack — CloudWatch dashboard named "HookMate-Operations"
# with 5 widgets, 5 CloudWatch alarms, and an SNS topic for notifications.
module "monitoring" {
  source = "./modules/monitoring"

  project_name = local.project_name
  environment  = local.environment

  ingestion_queue_arn = module.queues.ingestion_queue_arn
  dlq_arn             = module.queues.dlq_arn
  retry_queue_arn     = module.queues.retry_queue_arn
  ai_job_queue_arn    = module.queues.ai_job_queue_arn

  ingestion_lambda_arn   = module.lambdas.ingestion_lambda_arn
  processor_lambda_arn   = module.lambdas.processor_lambda_arn
  dlq_lambda_arn         = module.lambdas.dlq_lambda_arn
  ai_lambda_arn          = module.lambdas.ai_lambda_arn
  api_handler_lambda_arn = module.api_gateway.api_handler_lambda_arn

  db_instance_id   = module.database.db_instance_id
  cache_cluster_id = module.cache.cache_cluster_id
  http_api_id      = module.api_gateway.http_api_id
}
