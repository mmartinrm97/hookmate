import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSqsClient } from './sqs.client';
import { SqsService } from './sqs.service';

@Global()
@Module({
  providers: [
    {
      provide: 'SQS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>('AWS_REGION') ?? 'us-east-1';
        const endpointUrl = configService.get<string>('AWS_ENDPOINT_URL');

        return createSqsClient({ region, endpointUrl });
      },
      inject: [ConfigService],
    },
    {
      provide: 'SQS_QUEUE_URL',
      useFactory: (configService: ConfigService) => {
        return configService.get<string>('SQS_INGESTION_QUEUE_URL') ?? '';
      },
      inject: [ConfigService],
    },
    SqsService,
  ],
  exports: [SqsService],
})
export class SqsModule {}
