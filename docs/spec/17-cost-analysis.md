# 17. Cost Analysis

> [← Back to index](./README.md)

> **Note:** This file is a pre-deployment estimate. After the first real deploy, replace the estimates in sections 17.2–17.4 with actual Infracost output and real AWS cost data. The live version should be committed as `docs/cost-analysis.md`.

## 17.1 Cost drivers

| Resource           | Billing model           | Notes                                                    |
| ------------------ | ----------------------- | -------------------------------------------------------- |
| NAT Gateway        | $0.045/hr + $0.045/GB   | Single NAT in us-east-1a; biggest fixed cost item        |
| API Gateway        | $1.00/M HTTP requests   | $0 for first 1M requests/month (free tier)               |
| RDS t3.micro       | ~$25/mo                 | Multi-AZ disabled; not for prod use                      |
| ElastiCache cache.t3.micro | ~$15/mo       | Single node; not for prod use                            |
| Lambda             | $0.0000002/request + duration | Practically free at demo traffic levels          |
| SQS                | $0.40/M requests        | Practically free at demo traffic levels                  |
| CloudFront         | $0.0085/10K requests    | Practically free at demo traffic levels                  |
| S3                 | $0.023/GB stored        | < $1/mo for dashboard assets                             |

## 17.2 Cost by traffic tier (estimated monthly)

| Resource           | Idle (~0 events) | Low (1 event/sec) | Medium (10 events/sec) | High (100 events/sec) |
| ------------------ | ---------------- | ----------------- | ---------------------- | --------------------- |
| NAT Gateway        | $32              | $33               | $38                    | $65                   |
| API Gateway        | $0               | $2.6              | $26                    | $260                  |
| RDS t3.micro       | $25              | $25               | $25                    | $25                   |
| ElastiCache        | $15              | $15               | $15                    | $15                   |
| Lambda             | $0               | $1                | $8                     | $75                   |
| SQS                | $0               | $1                | $10                    | $100                  |
| CloudFront / S3    | $1               | $1                | $1                     | $2                    |
| EventBridge        | $0               | $0                | $0                     | $0                    |
| X-Ray              | $0               | $1                | $5                     | $50                   |
| CloudWatch         | $2               | $3                | $5                     | $35                   |
| **Total (est.)**   | **~$75**         | **~$83**          | **~$133**              | **~$627**             |

## 17.3 Cost optimization levers

| Option                           | Estimated savings | Tradeoff                                  |
| -------------------------------- | ----------------- | ----------------------------------------- |
| Use VPC endpoints instead of NAT | ~$28/mo           | More complex network config               |
| Share NAT across dev/staging     | ~$32/mo           | Dev and staging share egress IP           |
| Switch RDS to Aurora Serverless v2 | variable        | Scales to zero but cold-start latency     |
| Reserve RDS + ElastiCache (1yr)  | ~30%              | Upfront commitment                        |
| Reduce Lambda memory from 512MB  | ~20% Lambda cost  | Higher cold-start risk                    |

## 17.4 Infracost integration

Infracost is configured in CI via `.github/workflows/ci.yml`. On every PR that modifies `terraform/`:

1. `infracost breakdown --path terraform/ --format json` generates a cost JSON
2. `infracost/actions/comment` posts a PR comment with the monthly cost delta

Example PR comment output:

```
Project: hookmate/terraform

+ aws_db_instance.main                $25.55/mo
+ aws_elasticache_cluster.redis       $14.62/mo
+ aws_nat_gateway.main                $32.12/mo
...

Monthly cost change: +$78.42

┌─────────────────────────────────────────────┐
│ OVERALL TOTAL                  +$78.42/month │
└─────────────────────────────────────────────┘
```

This surfaces cost impact during code review — not after the bill arrives.
