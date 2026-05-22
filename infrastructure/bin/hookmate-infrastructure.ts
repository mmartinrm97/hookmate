import { App } from 'aws-cdk-lib';
import { HookMateBootstrapStack } from '../lib/hookmate-bootstrap-stack.js';

const app = new App();

new HookMateBootstrapStack(app, 'HookMateBootstrapStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
