import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Code, Function, Runtime, Tracing, type IFunction } from 'aws-cdk-lib/aws-lambda';
import { type ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { type IVpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface ApiStackProps extends StackProps {
  /** VPC for the API handler Lambda */
  readonly vpc: IVpc;

  /** Ingestion Lambda (from compute-stack) for the /webhooks route */
  readonly ingestionLambda: IFunction;

  /** DB credentials secret (for the NestJS API handler) */
  readonly dbSecret: ISecret;

  /** OpenAI API key secret (for the NestJS API handler) */
  readonly openAiSecret: ISecret;
}

export class ApiStack extends Stack {
  /** The HTTP API Gateway */
  public readonly httpApi: HttpApi;

  /** The NestJS API handler Lambda */
  public readonly apiHandlerLambda: IFunction;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { vpc, ingestionLambda, dbSecret, openAiSecret } = props;

    // --- NestJS API Handler Lambda ---
    // This Lambda runs the compiled NestJS application (aws-serverless-express).
    // It serves all management API routes (endpoints CRUD, event log, DLQ controls, etc.)
    this.apiHandlerLambda = new Function(this, 'ApiHandlerFunction', {
      runtime: Runtime.NODEJS_20_X,
      code: Code.fromAsset('../apps/api/dist'),
      handler: 'index.handler',
      memorySize: 256,
      timeout: Duration.seconds(30),
      tracing: Tracing.ACTIVE,
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      description: 'NestJS API handler — serves all management API routes',
      environment: {
        DB_SECRET_ARN: dbSecret.secretArn,
        OPENAI_API_KEY_SECRET_ARN: openAiSecret.secretArn,
        NODE_ENV: 'production',
      },
    });

    // Grant DB and OpenAI key access to the API handler
    dbSecret.grantRead(this.apiHandlerLambda);
    openAiSecret.grantRead(this.apiHandlerLambda);

    // --- HTTP API Gateway ---
    // HTTP API (v2) — lower cost and latency than REST API (v1).
    // CORS is enabled for the React dashboard (any origin for dev; restrict in prod).
    this.httpApi = new HttpApi(this, 'HookMateHttpApi', {
      apiName: 'hookmate-api',
      description: 'HookMate HTTP API — webhook ingestion and management',
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: Duration.days(1),
      },
    });

    // --- Ingestion Route ---
    // POST /webhooks/{endpointId} → Ingestion Lambda.
    // This is a lightweight function that validates the endpoint, persists the event,
    // enqueues the message to SQS, and returns 202 — without loading the full NestJS framework.
    const ingestionIntegration = new HttpLambdaIntegration('IngestionIntegration', ingestionLambda);

    this.httpApi.addRoutes({
      path: '/webhooks/{endpointId}',
      methods: [HttpMethod.POST],
      integration: ingestionIntegration,
    });

    // --- Management API Proxy Route ---
    // All remaining routes → NestJS API handler Lambda.
    // The NestJS app uses aws-serverless-express to route requests internally.
    const apiIntegration = new HttpLambdaIntegration('ApiIntegration', this.apiHandlerLambda);

    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [HttpMethod.ANY],
      integration: apiIntegration,
    });

    // --- Outputs ---
    new CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API endpoint URL (prod stage)',
    });

    new CfnOutput(this, 'ApiHandlerFunctionArn', {
      value: this.apiHandlerLambda.functionArn,
      description: 'NestJS API handler Lambda ARN',
    });
  }
}
