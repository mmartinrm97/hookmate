import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import { Inject, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DlqAlertService {
  private readonly logger = new Logger(DlqAlertService.name);

  constructor(
    @Inject('SNS_CLIENT')
    private readonly snsClient: SNSClient,
    @Inject('SNS_ALARM_TOPIC_ARN')
    private readonly topicArn: string,
  ) {}

  /**
   * Publishes an alert to the SNS alarm topic when the DLQ depth for an endpoint
   * exceeds its configured threshold.
   */
  async publishThresholdAlert(endpointId: string, depth: number, threshold: number): Promise<void> {
    if (!this.topicArn) {
      this.logger.warn(
        `SNS_ALARM_TOPIC_ARN is not configured; skipping threshold alert for endpoint ${endpointId}`,
      );
      return;
    }

    const message = {
      endpointId,
      depth,
      threshold,
      message: `DLQ depth ${depth} exceeds threshold ${threshold} for endpoint ${endpointId}`,
    };

    try {
      const command = new PublishCommand({
        TopicArn: this.topicArn,
        Subject: `DLQ Alert — Endpoint ${endpointId}`,
        Message: JSON.stringify(message),
        MessageAttributes: {
          endpoint_id: {
            DataType: 'String',
            StringValue: endpointId,
          },
          depth: {
            DataType: 'Number',
            StringValue: String(depth),
          },
          threshold: {
            DataType: 'Number',
            StringValue: String(threshold),
          },
        },
      });

      await this.snsClient.send(command);

      this.logger.warn(
        `DLQ threshold alert published for endpoint ${endpointId}: ${depth} > ${threshold}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish DLQ threshold alert for endpoint ${endpointId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
