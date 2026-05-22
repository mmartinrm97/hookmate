import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class HookMateBootstrapStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new CfnOutput(this, 'ProjectName', {
      value: 'hookmate',
      description: 'Bootstrap stack used to validate the CDK app wiring.',
    });

    new CfnOutput(this, 'TargetRegion', {
      value: this.region,
      description: 'Default AWS region for HookMate bootstrap infrastructure.',
    });
  }
}
