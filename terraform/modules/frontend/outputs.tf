output "dashboard_bucket_name" {
  description = "S3 bucket name for dashboard static assets."
  value       = aws_s3_bucket.dashboard.bucket
}

output "dashboard_bucket_arn" {
  description = "ARN of the dashboard S3 bucket."
  value       = aws_s3_bucket.dashboard.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.dashboard.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.dashboard.domain_name
}

output "oai_iam_arn" {
  description = "IAM ARN of the CloudFront OAI."
  value       = aws_cloudfront_origin_access_identity.dashboard.iam_arn
}
