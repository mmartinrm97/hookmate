import { App } from 'aws-cdk-lib';
import { HookMateAppStack } from '../lib/hookmate-app-stack';
import { HookMateBootstrapStack } from '../lib/hookmate-bootstrap-stack';

const app = new App();

// Bootstrap stack — validates CDK app wiring (kept for legacy/validation)
new HookMateBootstrapStack(app, 'HookMateBootstrapStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});

// Main application stack — orchestrates all infrastructure stacks
new HookMateAppStack(app, 'HookMateAppStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'HookMate webhook automation platform — all infrastructure',
});
