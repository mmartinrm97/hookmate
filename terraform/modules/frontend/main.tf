# ===========================================================================
# Frontend Module — S3 Bucket + CloudFront Distribution
# ===========================================================================
# Mirrors FrontendStack (infrastructure/lib/frontend-stack.ts).
#
# Creates:
#   1. S3 bucket for dashboard static assets (encrypted, private)
#   2. CloudFront Origin Access Identity (OAI) for secure bucket access
#   3. CloudFront distribution for global, low-latency delivery
#   4. S3 bucket policy restricting access to CloudFront OAI only
# ===========================================================================

# ---------------------------------------------------------------------------
# S3 Bucket
# ---------------------------------------------------------------------------
# Stores the compiled React dashboard (Vite output from apps/dashboard).
# Encrypted at rest (S3-managed), blocks ALL public access — accessible only
# via CloudFront OAI.
#
# Mirrors CDK:
#   new Bucket(this, 'HookMateDashboardBucket', {
#     removalPolicy: RemovalPolicy.DESTROY,
#     autoDeleteObjects: true,
#     encryption: BucketEncryption.S3_MANAGED,
#     enforceSSL: true,
#     blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
#     minimumTLSVersion: 1.2,
#   });
resource "aws_s3_bucket" "dashboard" {
  bucket        = "${var.project_name}-dashboard-${var.environment}"
  force_destroy = true # Equivalent to autoDeleteObjects: true + RemovalPolicy.DESTROY

  tags = {
    Name = "${var.project_name}-dashboard"
  }
}

# Block all public access to the bucket
resource "aws_s3_bucket_public_access_block" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable server-side encryption with S3-managed keys
resource "aws_s3_bucket_server_side_encryption_configuration" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Enforce HTTPS for all bucket access (mirrors CDK: enforceSSL: true)
resource "aws_s3_bucket_policy" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureConnections"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.dashboard.arn,
          "${aws_s3_bucket.dashboard.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "AllowCloudFrontOAIAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.dashboard.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.dashboard.arn}/*"
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# CloudFront Origin Access Identity
# ---------------------------------------------------------------------------
# OAI ensures CloudFront is the only way to access the S3 bucket.
# Mirrors CDK: new OriginAccessIdentity(this, 'DashboardOAI', { comment: '...' })
resource "aws_cloudfront_origin_access_identity" "dashboard" {
  comment = "OAI for HookMate dashboard CloudFront distribution"
}

# ---------------------------------------------------------------------------
# CloudFront Distribution
# ---------------------------------------------------------------------------
# Serves the React dashboard globally with low latency.
# Compression enabled, HTTPS enforced, SPA fallback for client-side routing.
#
# Mirrors CDK:
#   new Distribution(this, 'HookMateDistribution', {
#     defaultBehavior: {
#       origin: S3BucketOrigin.withOriginAccessIdentity(bucket, { originAccessIdentity: oai }),
#       compress: true,
#       viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
#     },
#     defaultRootObject: 'index.html',
#     errorResponses: [{ httpStatus: 403, responseHttpStatus: 200, ... }, { 404 -> 200, ... }],
#     enableIpv6: true,
#   });
resource "aws_cloudfront_distribution" "dashboard" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "HookMate React Dashboard"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # Use only North America and Europe (cost optimization)

  # Origin: S3 bucket via OAI
  origin {
    domain_name = aws_s3_bucket.dashboard.bucket_regional_domain_name
    origin_id   = "S3DashboardOrigin"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.dashboard.cloudfront_access_identity_path
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3DashboardOrigin"

    # CDK: compress: true, viewerProtocolPolicy: REDIRECT_TO_HTTPS
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Cache based on default TTL values (static assets can be cached longer)
    min_ttl     = 0
    default_ttl = 3600  # 1 hour
    max_ttl     = 86400 # 1 day

    # Forward query strings (needed for SPA routing)
    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  # SPA fallback: 403 and 404 errors serve index.html
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Viewer certificate (CloudFront default — *.cloudfront.net)
  # For custom domain, add aws_acm_certificate + viewer_certificate block
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # Restrict to US/EU only (cost — matches price_class)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name = "${var.project_name}-distribution"
  }
}
