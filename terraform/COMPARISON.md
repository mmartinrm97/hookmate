# CDK vs Terraform — Infrastructure-as-Code Comparison

> This document compares the AWS CDK (TypeScript) and Terraform (HCL) approaches
> for the same HookMate infrastructure. It's written as a learning resource for
> the portfolio reviewer and for anyone evaluating IaC tooling choices.

---

## 1. The Fundamental Difference

| Aspect | AWS CDK | Terraform |
|--------|---------|-----------|
| Language | TypeScript (or Python, Java, C#, Go) | HCL (HashiCorp Configuration Language) |
| State management | CloudFormation (managed by AWS) | S3 + DynamoDB (self-managed) |
| Execution model | `cdk synth` generates CloudFormation JSON → `cdk deploy` applies it | `terraform plan` previews → `terraform apply` executes |
| Provider model | AWS-only (via CloudFormation) | Multi-cloud (AWS, Azure, GCP, etc.) |
| Type safety | Full TypeScript type checking at compile time | Runtime validation via `terraform validate` |

---

## 2. Key Translation Patterns

### 2.1 IAM Permissions (grant\* methods → explicit policies)

**CDK (TypeScript):**
```typescript
ingestionQueue.grantSendMessages(this.ingestionLambda);
dbSecret.grantRead(this.ingestionLambda);
```

CDK's `grant*` methods are high-level abstractions that:
1. Create an IAM policy document with the correct actions
2. Create a new IAM policy (or add to existing) 
3. Attach the policy to the Lambda's execution role
4. All behind a single method call

**Terraform (HCL):**
```hcl
data "aws_iam_policy_document" "ingestion_permissions" {
  statement {
    actions   = ["sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
    resources = [var.ingestion_queue_arn]
  }
  statement {
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [var.db_secret_arn, var.openai_secret_arn]
  }
}
resource "aws_iam_policy" "ingestion" {
  policy = data.aws_iam_policy_document.ingestion_permissions.json
}
resource "aws_iam_role_policy_attachment" "ingestion" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.ingestion.arn
}
```

**Verdict:** CDK wins for developer velocity — one line vs ~15 lines. But Terraform wins for auditability — you can read exactly what each policy allows without digging into CDK construct source code.

### 2.2 Secret Rotation

**CDK:** When you call `Credentials.fromGeneratedSecret('hookmate_admin')`, CDK automatically:
- Creates an AWS Secrets Manager secret
- Generates a random password
- Enables automatic rotation every 30 days
- All as a single line of configuration

**Terraform:**
```hcl
resource "random_password" "db_master" { ... }
resource "aws_secretsmanager_secret" "db_credentials" { ... }
resource "aws_secretsmanager_secret_version" "db_credentials" { ... }
resource "aws_secretsmanager_secret_rotation" "db_credentials" { ... }
```

You must explicitly create the password, the secret, the version, AND the rotation schedule. The rotation Lambda function is also needed (unless you use the default RDS rotation template — `aws_secretsmanager_secret_rotation` with `automatically_after_days`).

**Verdict:** CDK is more concise for secrets management. Terraform is more explicit about what's happening.

### 2.3 VPC and Subnet Configuration

**CDK:**
```typescript
new Vpc(this, 'HookMateVPC', {
  ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
  maxAzs: 2,
  subnetConfiguration: [
    { name: 'Public', subnetType: SubnetType.PUBLIC, cidrMask: 24 },
    { name: 'Private', subnetType: SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
  ],
  natGateways: 1,
});
```

CDK's `Vpc` construct automatically creates subnets, route tables, IGW, NAT Gateways, and all associations — roughly 15 AWS resources from 15 lines of code.

**Terraform:** The equivalent requires ~120 lines across the `modules/vpc/main.tf` file — every subnet, route table, association, and gateway is an explicit resource.

**Verdict:** CDK constructs are dramatically more productive for well-known patterns like VPCs. Terraform requires exhaustive detail but gives full control.

### 2.4 SQS Dead-Letter Queues

**CDK:**
```typescript
this.ingestionQueue = new Queue(this, 'HookMateIngestionQueue', {
  deadLetterQueue: {
    queue: this.dlq,
    maxReceiveCount: 3,
  },
});
```

**Terraform:**
```hcl
resource "aws_sqs_queue" "ingestion" {
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}
```

**Verdict:** Similar expressiveness — both are straightforward, but CDK's first-class `deadLetterQueue` property is slightly cleaner than Terraform's `jsonencode` workaround.

---

## 3. Architecture Patterns

### 3.1 Cross-Stack References

**CDK** handles cross-stack references automatically:
```typescript
const computeStack = new ComputeStack(this, 'HookMateComputeStack', {
  ingestionQueue: queueStack.ingestionQueue,  // CDK automatically creates export/import
});
```
CDK generates CloudFormation exports and imports (`Fn::ImportValue` / `Fn::GetAtt`) automatically when you pass constructs between stacks.

**Terraform** requires explicit outputs and `data.terraform_remote_state` or directly referenced module outputs:
```hcl
# In one module's outputs.tf
output "ingestion_queue_arn" {
  value = aws_sqs_queue.ingestion.arn
}

# In root main.tf
ingestion_queue_arn = module.queues.ingestion_queue_arn
```

**Verdict:** CDK is more ergonomic for TypeScript monorepos. Terraform's module outputs are clean but require more boilerplate.

### 3.2 State Management

| Aspect | CDK | Terraform |
|--------|-----|-----------|
| State storage | CloudFormation in S3 (managed by CDK bootstrap) | S3 bucket (self-managed) |
| State locking | Built into CloudFormation | DynamoDB table (must be created manually) |
| State inspection | CloudFormation console, `cdk diff` | `terraform show`, `terraform state list` |
| Drift detection | CloudFormation drift detection | `terraform plan` (compares state to real resources) |
| Team collaboration | CloudFormation handles concurrency | DynamoDB locks prevent concurrent applies |

### 3.3 Error Handling & Rollback

**CDK / CloudFormation:**
- If a resource fails during deployment, CloudFormation automatically rolls back
- Stack events provide detailed failure information
- `cdk diff` shows what changed before deployment

**Terraform:**
- If a resource fails, Terraform marks it as "tainted" and stops
- Manual intervention may be required for partial failures
- `terraform plan` always shows the diff first
- `terraform apply -replace=resource` allows targeted replacement

---

## 4. Which is Easier to Refactor?

### CDK wins for TypeScript teams because:
- **Constructs:** Share VPC configurations, IAM patterns, and Lambda configs across stacks via TypeScript classes
- **`aws-cdk-lib`:** Well-typed L2 constructs abstract away hundreds of lines of CloudFormation
- **IDE support:** Full autocomplete, refactoring, and type checking for all infrastructure code
- **Cross-stack references:** Passing constructs between stacks is type-safe and automatic

### Terraform wins for multi-cloud or non-TypeScript teams because:
- **HCL is declarative:** Easier for ops teams who don't write TypeScript
- **Multi-cloud:** Manage AWS + Cloudflare + Datadog in the same configuration
- **No compilation step:** `terraform plan` runs directly on HCL
- **State inspection:** `terraform show` and `terraform state` commands give deep insight

---

## 5. HookMate-Specific Observations

### 5.1 What was harder in Terraform (compared to CDK)

1. **IAM policy construction:** CDK's `grant*` methods are significantly more concise. Each translated to 15-20 lines of HCL.
2. **VPC creation:** CDK's `Vpc` construct creates all networking resources in ~15 lines. The Terraform equivalent is ~120 lines.
3. **RDS enhanced monitoring:** CDK handles the IAM role automatically. Terraform requires `aws_iam_role` + policy attachment + `depends_on`.
4. **CloudWatch metric math alarms:** CDK's `MathExpression` is a first-class construct. Terraform's metric math alarm syntax (JSON-like expression blocks) is more verbose.

### 5.2 What was clearer in Terraform (compared to CDK)

1. **Explicit resource dependencies:** Every Terraform resource shows its exact dependencies through references (or `depends_on`). CDK hides these in construct internals.
2. **Policy audit trail:** The IAM policy documents in Terraform are plain JSON — easy to review, copy, or feed to security audit tools. CDK's `grant*` methods obscure the final policy.
3. **Resource naming:** Terraform names are explicit (`hookmate-ingestion`, `hookmate-dlq`). CDK auto-generates CloudFormation logical IDs that can be opaque.

---

## 6. Summary

| Criterion | Winner | Why |
|-----------|--------|-----|
| Developer velocity | CDK | Constructs reduce boilerplate by 5-10x |
| Auditability / transparency | Terraform | Explicit resources, plain-text policies |
| Multi-cloud support | Terraform | Only option |
| Type safety | CDK | Full TypeScript compile-time checking |
| Learning curve | CDK (for devs) / Terraform (for ops) | Depends on background |
| State management | CDK | CloudFormation handles this automatically |
| Cross-stack refs | CDK | Automatic, type-safe |
| Secret rotation | CDK | Built into RDS construct |
| Refactoring at scale | CDK | Constructs + TypeScript make this easier |

For **HookMate specifically**, CDK is the right choice because:
- The team is TypeScript-first (NestJS API, React dashboard, shared types)
- The infrastructure is AWS-only (no multi-cloud requirement)
- Portfolio value: demonstrating modern IaC patterns with CDK
- The Terraform mirror exists specifically for the learning/comparison value

The Terraform mirror proves that **the same infrastructure CAN be expressed in both tools** — the question is which one better serves your team's skills, workflows, and requirements.

---

## 7. References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/)
- [CDK vs Terraform: In-depth comparison](https://docs.aws.amazon.com/prescriptive-guidance/latest/choosing-cdk-terraform/)
- HookMate CDK stacks: `infrastructure/lib/*.ts`
- HookMate Terraform modules: `terraform/modules/*/`
