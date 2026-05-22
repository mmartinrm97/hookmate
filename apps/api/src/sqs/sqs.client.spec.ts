import { SQSClient } from '@aws-sdk/client-sqs';
import { describe, expect, it } from 'vitest';
import { createSqsClient } from './sqs.client';

describe('createSqsClient', () => {
  it('returns an SQSClient instance', () => {
    const client = createSqsClient({ region: 'us-east-1' });

    expect(client).toBeInstanceOf(SQSClient);
  });

  it('uses the provided region', () => {
    const client = createSqsClient({ region: 'eu-west-1' });

    expect(client).toBeInstanceOf(SQSClient);
  });

  it('uses the provided endpoint URL when given', () => {
    const client = createSqsClient({
      region: 'us-east-1',
      endpointUrl: 'http://localhost:4566',
    });

    expect(client).toBeInstanceOf(SQSClient);
  });
});
