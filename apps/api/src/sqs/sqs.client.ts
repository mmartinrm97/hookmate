import { SQSClient } from '@aws-sdk/client-sqs';

export interface SqsClientConfig {
  region: string;
  endpointUrl?: string;
}

export function createSqsClient(config: SqsClientConfig): SQSClient {
  const clientConfig: ConstructorParameters<typeof SQSClient>[0] = {
    region: config.region,
  };

  if (config.endpointUrl) {
    clientConfig.endpoint = config.endpointUrl;
  }

  return new SQSClient(clientConfig);
}
