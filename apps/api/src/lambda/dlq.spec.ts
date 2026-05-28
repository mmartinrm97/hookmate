import type { SQSEvent } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { handler, parseDlqMessage } from './dlq';

function createMockSqsRecord(
  body: string,
  messageId: string = 'msg-001',
): SQSEvent['Records'][number] {
  return {
    messageId,
    receiptHandle: 'receipt-001',
    body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: Date.now().toString(),
      SenderId: 'AWS',
      ApproximateFirstReceiveTimestamp: Date.now().toString(),
    },
    messageAttributes: {},
    md5OfBody: 'abc123',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:hookmate-dlq',
    awsRegion: 'us-east-1',
  };
}

describe('DLQ Lambda Handler', () => {
  describe('parseDlqMessage()', () => {
    it('parses a valid JSON message body', () => {
      const body = JSON.stringify({
        event_id: 'evt-failed-01',
        endpoint_id: 'ep-01JHQ',
        attempt_number: 5,
      });

      const result = parseDlqMessage(body);

      expect(result).toEqual({
        eventId: 'evt-failed-01',
        endpointId: 'ep-01JHQ',
        attemptNumber: 5,
      });
    });

    it('throws on invalid JSON', () => {
      expect(() => parseDlqMessage('not json')).toThrow('Invalid DLQ message format');
    });

    it('throws when event_id is missing', () => {
      const body = JSON.stringify({ endpoint_id: 'ep-01JHQ' });

      expect(() => parseDlqMessage(body)).toThrow('Missing required field: event_id');
    });

    it('throws when endpoint_id is missing', () => {
      const body = JSON.stringify({ event_id: 'evt-001' });

      expect(() => parseDlqMessage(body)).toThrow('Missing required field: endpoint_id');
    });

    it('defaults attempt_number to 1 when not provided', () => {
      const body = JSON.stringify({
        event_id: 'evt-001',
        endpoint_id: 'ep-01JHQ',
      });

      const result = parseDlqMessage(body);

      expect(result.attemptNumber).toBe(1);
    });

    it('extracts failure_reason when present', () => {
      const body = JSON.stringify({
        event_id: 'evt-001',
        endpoint_id: 'ep-01JHQ',
        failure_reason: 'Circuit open — failure rate exceeded',
      });

      const result = parseDlqMessage(body);

      expect(result.failureReason).toBe('Circuit open — failure rate exceeded');
    });
  });

  describe('handler()', () => {
    it('processes all valid records with no batchItemFailures', async () => {
      const event: SQSEvent = {
        Records: [
          createMockSqsRecord(
            JSON.stringify({
              event_id: 'evt-001',
              endpoint_id: 'ep-001',
              attempt_number: 5,
              failure_reason: 'Max retries exceeded',
            }),
            'msg-001',
          ),
          createMockSqsRecord(
            JSON.stringify({
              event_id: 'evt-002',
              endpoint_id: 'ep-002',
              attempt_number: 3,
              failure_reason: 'Circuit open',
            }),
            'msg-002',
          ),
        ],
      };

      const result = await handler(event);

      expect(result.batchItemFailures).toEqual([]);
    });

    it('returns batchItemFailures for records with invalid JSON', async () => {
      const event: SQSEvent = {
        Records: [
          createMockSqsRecord('not valid json', 'msg-bad'),
          createMockSqsRecord(
            JSON.stringify({
              event_id: 'evt-001',
              endpoint_id: 'ep-001',
              attempt_number: 5,
            }),
            'msg-good',
          ),
        ],
      };

      const result = await handler(event);

      expect(result.batchItemFailures).toHaveLength(1);
      expect(result.batchItemFailures[0]?.itemIdentifier).toBe('msg-bad');
    });

    it('returns batchItemFailures for records missing required fields', async () => {
      const event: SQSEvent = {
        Records: [
          createMockSqsRecord(JSON.stringify({ endpoint_id: 'ep-001' }), 'msg-missing-event'),
          createMockSqsRecord(JSON.stringify({ event_id: 'evt-001' }), 'msg-missing-endpoint'),
          createMockSqsRecord(
            JSON.stringify({
              event_id: 'evt-001',
              endpoint_id: 'ep-001',
              attempt_number: 5,
            }),
            'msg-good',
          ),
        ],
      };

      const result = await handler(event);

      expect(result.batchItemFailures).toHaveLength(2);
      const failedIds = result.batchItemFailures.map((f) => f.itemIdentifier);
      expect(failedIds).toContain('msg-missing-event');
      expect(failedIds).toContain('msg-missing-endpoint');
    });

    it('handles empty Records array', async () => {
      const event: SQSEvent = { Records: [] };

      const result = await handler(event);

      expect(result.batchItemFailures).toEqual([]);
    });

    it('handles circuit_open failure reason', async () => {
      const event: SQSEvent = {
        Records: [
          createMockSqsRecord(
            JSON.stringify({
              event_id: 'evt-cb-001',
              endpoint_id: 'ep-001',
              attempt_number: 1,
              failure_reason: 'Circuit open — failure rate exceeded, cooldown 120s',
            }),
            'msg-cb',
          ),
        ],
      };

      const result = await handler(event);

      expect(result.batchItemFailures).toEqual([]);
    });
  });
});
