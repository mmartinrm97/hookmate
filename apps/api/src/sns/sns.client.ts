import { SNSClient } from '@aws-sdk/client-sns';

export interface SnsClientConfig {
  region: string;
  endpointUrl?: string;
}

export function createSnsClient(config: SnsClientConfig): SNSClient {
  const clientConfig: ConstructorParameters<typeof SNSClient>[0] = {
    region: config.region,
  };

  if (config.endpointUrl) {
    clientConfig.endpoint = config.endpointUrl;
  }

  return new SNSClient(clientConfig);
}
