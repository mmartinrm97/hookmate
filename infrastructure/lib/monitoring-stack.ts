import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import {
  Alarm,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  LogQueryWidget,
  MathExpression,
  Metric,
  SingleValueWidget,
  Stats,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { type IDatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { type IFunction } from 'aws-cdk-lib/aws-lambda';
import { type IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends StackProps {
  /** SQS queues for dashboard metrics */
  readonly ingestionQueue: IQueue;
  readonly dlq: IQueue;
  readonly retryQueue: IQueue;
  readonly aiJobQueue: IQueue;

  /** Lambda functions for error monitoring */
  readonly ingestionLambda: IFunction;
  readonly processorLambda: IFunction;
  readonly dlqLambda: IFunction;
  readonly aiLambda: IFunction;
  readonly apiHandlerLambda: IFunction;

  /** RDS instance for CPU monitoring */
  readonly rdsInstance: IDatabaseInstance;

  /** ElastiCache cluster ID for CPU monitoring */
  readonly cacheClusterId: string;

  /** HTTP API ID for API Gateway 5xx monitoring */
  readonly httpApiId: string;
}

export class MonitoringStack extends Stack {
  /** SNS topic for alarm notifications */
  public readonly alarmTopic: Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const {
      ingestionQueue,
      dlq,
      retryQueue,
      aiJobQueue,
      ingestionLambda,
      processorLambda,
      dlqLambda,
      aiLambda,
      apiHandlerLambda,
      rdsInstance,
      cacheClusterId,
      httpApiId,
    } = props;

    // --- SNS Topic for Alarm Notifications ---
    // All alarms publish to this SNS topic. In production, subscribe
    // Slack/Discord/Email endpoints via CloudFormation or manually.
    this.alarmTopic = new Topic(this, 'HookMateAlarmTopic', {
      topicName: 'hookmate-alarms',
      displayName: 'HookMate Operational Alarms',
    });

    // --- Dashboard ---
    // Named dashboard per spec: HookMate-Operations
    const dashboard = new Dashboard(this, 'HookMateDashboard', {
      dashboardName: 'HookMate-Operations',
    });

    // Widget: Queue Depth (all queues)
    dashboard.addWidgets(
      new GraphWidget({
        title: 'Queue Depth',
        left: [
          dlq.metricApproximateNumberOfMessagesVisible({
            label: 'DLQ',
            statistic: Stats.SUM,
          }),
          ingestionQueue.metricApproximateNumberOfMessagesVisible({
            label: 'Ingestion',
            statistic: Stats.SUM,
          }),
          retryQueue.metricApproximateNumberOfMessagesVisible({
            label: 'Retry',
            statistic: Stats.SUM,
          }),
          aiJobQueue.metricApproximateNumberOfMessagesVisible({
            label: 'AI Jobs',
            statistic: Stats.SUM,
          }),
        ],
        width: 12,
      }),
    );

    // Widget: Lambda Error Rate
    const totalErrorMetric = new MathExpression({
      expression: 'e1 + e2 + e3 + e4 + e5',
      usingMetrics: {
        e1: ingestionLambda.metricErrors({ statistic: Stats.SUM }),
        e2: processorLambda.metricErrors({ statistic: Stats.SUM }),
        e3: dlqLambda.metricErrors({ statistic: Stats.SUM }),
        e4: aiLambda.metricErrors({ statistic: Stats.SUM }),
        e5: apiHandlerLambda.metricErrors({ statistic: Stats.SUM }),
      },
      label: 'Total Lambda Errors',
    });

    const totalInvocationMetric = new MathExpression({
      expression: 'i1 + i2 + i3 + i4 + i5',
      usingMetrics: {
        i1: ingestionLambda.metricInvocations({ statistic: Stats.SUM }),
        i2: processorLambda.metricInvocations({ statistic: Stats.SUM }),
        i3: dlqLambda.metricInvocations({ statistic: Stats.SUM }),
        i4: aiLambda.metricInvocations({ statistic: Stats.SUM }),
        i5: apiHandlerLambda.metricInvocations({ statistic: Stats.SUM }),
      },
      label: 'Total Lambda Invocations',
    });

    const errorRateMetric = new MathExpression({
      expression: 'IF(m1 == 0, 0, m2 / m1) * 100',
      usingMetrics: {
        m1: totalInvocationMetric,
        m2: totalErrorMetric,
      },
      label: 'Error Rate %',
    });

    dashboard.addWidgets(
      new GraphWidget({
        title: 'Lambda Error Rate',
        left: [errorRateMetric],
        width: 12,
      }),
    );

    // Widget: RDS CPU Utilization
    dashboard.addWidgets(
      new SingleValueWidget({
        title: 'RDS CPU',
        metrics: [rdsInstance.metricCPUUtilization()],
        width: 6,
      }),
    );

    // Widget: DLQ Depth (prominent single-value)
    dashboard.addWidgets(
      new SingleValueWidget({
        title: 'DLQ Depth',
        metrics: [
          dlq.metricApproximateNumberOfMessagesVisible({
            statistic: Stats.SUM,
          }),
        ],
        width: 6,
      }),
    );

    // Widget: Cold Starts & Delivery Latency (logs-based)
    dashboard.addWidgets(
      new LogQueryWidget({
        title: 'Lambda Cold Starts',
        logGroupNames: [
          `/aws/lambda/${ingestionLambda.functionName}`,
          `/aws/lambda/${processorLambda.functionName}`,
          `/aws/lambda/${dlqLambda.functionName}`,
          `/aws/lambda/${aiLambda.functionName}`,
          `/aws/lambda/${apiHandlerLambda.functionName}`,
        ],
        queryString:
          'filter @type = "REPORT"\n| filter @initDuration > 0\n| stats count() by function_name',
        width: 12,
      }),
    );

    // --- Alarms ---

    // 1. DLQ Depth > 100
    const dlqAlarm = new Alarm(this, 'DLQDepthAlarm', {
      alarmName: 'HookMate-DLQ-Depth',
      alarmDescription: 'Alert when DLQ has more than 100 messages — investigate failed events',
      metric: dlq.metricApproximateNumberOfMessagesVisible({
        statistic: Stats.SUM,
      }),
      threshold: 100,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    dlqAlarm.addAlarmAction(new SnsAction(this.alarmTopic));

    // 2. Lambda Error Rate > 5%
    const lambdaErrorRateAlarm = new Alarm(this, 'LambdaErrorRateAlarm', {
      alarmName: 'HookMate-Lambda-Error-Rate',
      alarmDescription: 'Alert when aggregate Lambda error rate exceeds 5% over 5 minutes',
      metric: errorRateMetric,
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    lambdaErrorRateAlarm.addAlarmAction(new SnsAction(this.alarmTopic));

    // 3. RDS CPU > 80% for 10 minutes
    const rdsCpuAlarm = new Alarm(this, 'RdsCpuAlarm', {
      alarmName: 'HookMate-RDS-CPU',
      alarmDescription: 'Alert when RDS CPU exceeds 80% for 10 minutes — consider scaling up',
      metric: rdsInstance.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 2, // 2 periods of 5 minutes each = 10 minutes
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    rdsCpuAlarm.addAlarmAction(new SnsAction(this.alarmTopic));

    // 4. API Gateway 5xx Rate > 1%
    const api5xxMetric = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XX',
      dimensionsMap: { ApiId: httpApiId },
      statistic: Stats.SUM,
      label: 'API Gateway 5XX',
    });

    const apiCountMetric = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: { ApiId: httpApiId },
      statistic: Stats.SUM,
      label: 'API Gateway Total Requests',
    });

    const api5xxRateMetric = new MathExpression({
      expression: 'IF(m1 == 0, 0, m2 / m1) * 100',
      usingMetrics: {
        m1: apiCountMetric,
        m2: api5xxMetric,
      },
      label: 'API Gateway 5XX Rate %',
    });

    const api5xxAlarm = new Alarm(this, 'Api5xxRateAlarm', {
      alarmName: 'HookMate-API-5xx-Rate',
      alarmDescription: 'Alert when API Gateway 5xx error rate exceeds 1% over 5 minutes',
      metric: api5xxRateMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    api5xxAlarm.addAlarmAction(new SnsAction(this.alarmTopic));

    // 5. ElastiCache CPU > 80%
    const cacheCpuMetric = new Metric({
      namespace: 'AWS/ElastiCache',
      metricName: 'CPUUtilization',
      dimensionsMap: { CacheClusterId: cacheClusterId },
      statistic: Stats.AVERAGE,
      label: 'ElastiCache CPU',
    });

    const cacheCpuAlarm = new Alarm(this, 'CacheCpuAlarm', {
      alarmName: 'HookMate-ElastiCache-CPU',
      alarmDescription: 'Alert when ElastiCache Redis CPU exceeds 80% — consider scaling up',
      metric: cacheCpuMetric,
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    cacheCpuAlarm.addAlarmAction(new SnsAction(this.alarmTopic));

    // --- Outputs ---
    new CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS topic ARN for alarm notifications',
    });

    new CfnOutput(this, 'DashboardName', {
      value: dashboard.dashboardName,
      description: 'CloudWatch dashboard name',
    });
  }
}
