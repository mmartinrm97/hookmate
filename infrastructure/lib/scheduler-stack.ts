import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { type IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface SchedulerStackProps extends StackProps {
  /** AI Lambda to invoke on schedule */
  readonly aiLambda: IFunction;
}

export class SchedulerStack extends Stack {
  constructor(scope: Construct, id: string, props: SchedulerStackProps) {
    super(scope, id, props);

    const { aiLambda } = props;

    // --- EventBridge Rule ---
    // Fires every 30 minutes to trigger the AI summary generation job.
    // The AI Lambda aggregates events from the last 24h per endpoint,
    // calls OpenAI gpt-4o-mini, and writes summaries to `ai_summaries`.
    //
    // Using EventBridge rules (not the newer Scheduler) for simplicity
    // and since we don't need flexible timezone or one-time schedules.
    const rule = new Rule(this, 'AiSummarySchedule', {
      ruleName: 'hookmate-ai-summary-trigger',
      description: 'Triggers AI summary generation every 30 minutes',
      schedule: Schedule.expression('cron(*/30 * * * ? *)'),
      targets: [
        new LambdaFunction(aiLambda, {
          event: RuleTargetInput.fromObject({
            jobType: 'generate-summary',
          }),
        }),
      ],
      enabled: true,
    });

    // Note: LambdaFunction target automatically grants invoke permission
    // to the EventBridge service principal via CDK's target wiring.

    // --- Outputs ---
    new CfnOutput(this, 'AiScheduleRuleArn', {
      value: rule.ruleArn,
      description: 'EventBridge rule ARN for AI summary schedule',
    });

    new CfnOutput(this, 'AiScheduleRuleName', {
      value: rule.ruleName,
      description: 'EventBridge rule name for AI summary schedule',
    });
  }
}
