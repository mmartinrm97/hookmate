output "http_api_id" {
  description = "HTTP API ID (used for CloudWatch metrics in monitoring module)."
  value       = aws_apigatewayv2_api.http.id
}

output "http_api_url" {
  description = "HTTP API endpoint URL."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "api_handler_lambda_arn" {
  description = "ARN of the NestJS API handler Lambda."
  value       = aws_lambda_function.api_handler.arn
}
