import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption, type IBucket } from 'aws-cdk-lib/aws-s3';
import {
  Distribution,
  OriginAccessIdentity,
  ViewerProtocolPolicy,
  type IDistribution,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class FrontendStack extends Stack {
  /** The S3 bucket storing dashboard static assets */
  public readonly dashboardBucket: IBucket;

  /** CloudFront distribution for the dashboard */
  public readonly distribution: IDistribution;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- S3 Bucket ---
    // Stores the compiled React dashboard (Vite output).
    // Encrypted at rest, blocks ALL public access (access only via CloudFront OAI).
    this.dashboardBucket = new Bucket(this, 'HookMateDashboardBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // clean up on stack destroy (safe for dev/portfolio)
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      minimumTLSVersion: 1.2,
    });

    // --- CloudFront Origin Access Identity ---
    // OAI ensures CloudFront is the only way to access the S3 bucket.
    const oai = new OriginAccessIdentity(this, 'DashboardOAI', {
      comment: 'OAI for HookMate dashboard CloudFront distribution',
    });

    // --- CloudFront Distribution ---
    // Serves the React dashboard globally with low latency.
    // Compression enabled, HTTPS enforced, SPA fallback for client-side routing.
    this.distribution = new Distribution(this, 'HookMateDistribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessIdentity(this.dashboardBucket, {
          originAccessIdentity: oai,
        }),
        compress: true,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      // SPA fallback: any 403/404 serves index.html so React Router handles routing
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      // Enable additional CloudFront features
      enableIpv6: true,
      comment: 'HookMate React Dashboard',
    });

    // --- Outputs ---
    new CfnOutput(this, 'DashboardBucketName', {
      value: this.dashboardBucket.bucketName,
      description: 'S3 bucket name for dashboard static assets',
    });

    new CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new CfnOutput(this, 'CloudFrontDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
  }
}
