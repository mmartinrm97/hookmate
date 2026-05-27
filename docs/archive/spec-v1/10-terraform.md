# 10. Terraform

> [← Back to index](./README.md)

## 10.1 File structure

```
terraform/
├── main.tf          — module wiring
├── variables.tf     — input variables
├── outputs.tf       — output values
├── providers.tf     — AWS provider config
├── backend.tf       — S3 backend for remote state
├── versions.tf      — provider version constraints
└── modules/
    ├── network/
    ├── database/
    ├── queue/
    ├── cache/
    └── lambda/
```

## 10.2 Key differences vs CDK

1. **Permission syntax**: CDK uses `.grantSendMessages(fn)` — Terraform requires explicit `aws_iam_policy_document` + `aws_iam_role_policy_attachment`
2. **Secret rotation**: CDK `Credentials.fromGeneratedSecret()` sets up rotation automatically — Terraform requires `aws_secretsmanager_secret_rotation` resource explicitly
3. **Construct abstractions**: CDK `DatabaseInstance` compose many sub-resources. In Terraform each component is explicit: `aws_db_instance`, `aws_db_subnet_group`, `aws_db_parameter_group`
4. **State management**: Terraform uses S3 remote state + DynamoDB locking; CDK uses CloudFormation native state management
5. **Type safety**: CDK TypeScript compiler catches bad configs at compile time; Terraform has no compile-time checks — errors surface only on `plan` or `apply`

These differences are documented in [`terraform/COMPARISON.md`](../../terraform/COMPARISON.md).
