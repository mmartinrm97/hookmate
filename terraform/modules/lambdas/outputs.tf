output "ingestion_lambda_arn" {
  description = "ARN of the Ingestion Lambda function."
  value       = aws_lambda_function.ingestion.arn
}

output "ingestion_lambda_name" {
  description = "Name of the Ingestion Lambda function."
  value       = aws_lambda_function.ingestion.function_name
}

output "processor_lambda_arn" {
  description = "ARN of the Processor Lambda function."
  value       = aws_lambda_function.processor.arn
}

output "dlq_lambda_arn" {
  description = "ARN of the DLQ Lambda function."
  value       = aws_lambda_function.dlq.arn
}

output "ai_lambda_arn" {
  description = "ARN of the AI Lambda function."
  value       = aws_lambda_function.ai.arn
}

output "ai_lambda_name" {
  description = "Name of the AI Lambda function."
  value       = aws_lambda_function.ai.function_name
}

output "lambda_security_group_id" {
  description = "Security group ID for Lambda functions."
  value       = aws_security_group.lambda.id
}
