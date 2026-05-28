import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { Logger } from '@nestjs/common';

const logger = new Logger('DlqLambda');

export interface ParsedDlqMessage {
  eventId: string;
  endpointId: string;
  attemptNumber: number;
  failureReason?: string;
}

/**
 * Parses a DLQ SQS message body into a structured ParsedDlqMessage.
 * Throws on invalid format or missing required fields.
 */
export function parseDlqMessage(body: string): ParsedDlqMessage {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('Invalid DLQ message format: expected JSON');
  }

  const eventId = parsed.event_id as string | undefined;
  if (!eventId) {
    throw new Error('Missing required field: event_id');
  }

  const endpointId = parsed.endpoint_id as string | undefined;
  if (!endpointId) {
    throw new Error('Missing required field: endpoint_id');
  }

  return {
    eventId,
    endpointId,
    attemptNumber: (parsed.attempt_number as number) ?? 1,
    failureReason: parsed.failure_reason as string | undefined,
  };
}

/**
 * Processes a single DLQ SQS record.
 * In production, this bootstraps NestJS and calls DlqPromoterService.
 * For now, logs the DLQ event and returns success.
 *
 * TODO: Integrate with DlqPromoterService when NestJS Lambda bootstrap is implemented.
 * The full flow should be:
 * 1. Bootstrap NestJS app (cached across invocations)
 * 2. Get DlqPromoterService from the app
 * 3. Look up event and endpoint from database
 * 4. Call DlqPromoterService.promote(event, endpoint, attempts, failureReason)
 */
async function processDlqRecord(_record: SQSRecord, message: ParsedDlqMessage): Promise<void> {
  logger.log(
    `Processing DLQ event: ${message.eventId} for endpoint ${message.endpointId} (attempt ${message.attemptNumber})`,
  );

  if (message.failureReason) {
    logger.log(`Failure reason: ${message.failureReason}`);
  }

  // TODO: Replace with actual DlqPromoterService integration
  // await dlqPromoterService.promote(event, endpoint, attempts, message.failureReason ?? 'DLQ Lambda promotion');

  logger.log(`DLQ event ${message.eventId} processed successfully`);
}

/**
 * DLQ Lambda handler — consumes messages from the SQS DLQ queue.
 *
 * Triggered when SQS auto-moves messages to the DLQ queue after maxReceiveCount.
 * This is a safety net for events that failed all retry attempts.
 *
 * Returns partial failure response (batchItemFailures) for records that failed processing,
 * allowing SQS to retry only the failed messages.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const message = parseDlqMessage(record.body);
      await processDlqRecord(record, message);
    } catch (error) {
      logger.error(`Failed to process DLQ record ${record.messageId}: ${(error as Error).message}`);
      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  return { batchItemFailures };
}
