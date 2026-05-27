import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createSnsClient } from '../sns/sns.client';
import { DlqAlertService } from './dlq-alert.service';
import { DlqEventsController } from './dlq-events.controller';
import { DlqEventsService } from './dlq-events.service';
import { DlqEvent } from './entities/dlq-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DlqEvent]), BullModule.registerQueue({ name: 'retries' })],
  controllers: [DlqEventsController],
  providers: [
    DlqEventsService,
    DlqAlertService,
    {
      provide: 'SNS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>('AWS_REGION') ?? 'us-east-1';
        const endpointUrl = configService.get<string>('AWS_ENDPOINT_URL');

        return createSnsClient({ region, endpointUrl });
      },
      inject: [ConfigService],
    },
    {
      provide: 'SNS_ALARM_TOPIC_ARN',
      useFactory: (configService: ConfigService) => {
        return configService.get<string>('SNS_ALARM_TOPIC_ARN') ?? '';
      },
      inject: [ConfigService],
    },
  ],
  exports: [DlqEventsService, DlqAlertService],
})
export class DlqEventsModule {}
