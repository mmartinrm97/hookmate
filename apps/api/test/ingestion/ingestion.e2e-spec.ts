import { SQSClient, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { ulid } from 'ulid';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';

// Provide safe defaults so the module config does not throw.
// Postgres must be running (via docker-compose) for e2e tests.
process.env['POSTGRES_USER'] = process.env['POSTGRES_USER'] ?? 'hookmate';
process.env['POSTGRES_PASSWORD'] = process.env['POSTGRES_PASSWORD'] ?? 'hookmate';
process.env['POSTGRES_DB'] = process.env['POSTGRES_DB'] ?? 'hookmate';
process.env['SQS_INGESTION_QUEUE_URL'] =
  process.env['SQS_INGESTION_QUEUE_URL'] ?? 'http://localhost:4566/000000000000/ingestion';
process.env['AWS_ENDPOINT_URL'] = process.env['AWS_ENDPOINT_URL'] ?? 'http://localhost:4566';
process.env['AWS_REGION'] = process.env['AWS_REGION'] ?? 'us-east-1';
process.env['AWS_ACCESS_KEY_ID'] = process.env['AWS_ACCESS_KEY_ID'] ?? 'test';
process.env['AWS_SECRET_ACCESS_KEY'] = process.env['AWS_SECRET_ACCESS_KEY'] ?? 'test';

interface EndpointPayload {
  id: string;
  name: string;
  destinationUrl: string;
  status: string;
  secret?: string;
}

interface IngestResponse {
  event_id: string;
  trace_id: string;
  received_at: string;
}

const isDbAvailable = !!process.env['POSTGRES_HOST'];
const e2eSuite = describe.skipIf(!isDbAvailable);

e2eSuite('POST /webhooks/:endpointId (e2e)', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    // Clean all tables before each test
    await dataSource.query('DELETE FROM ai_summaries');
    await dataSource.query('DELETE FROM dlq_events');
    await dataSource.query('DELETE FROM delivery_attempts');
    await dataSource.query('DELETE FROM routing_rules');
    await dataSource.query('DELETE FROM events');
    await dataSource.query('DELETE FROM endpoints');
  });

  it('returns 202 with event_id, trace_id, and received_at', async () => {
    // Arrange: create an active endpoint via the management API
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/endpoints')
      .send({
        name: 'Ingestion e2e test',
        destinationUrl: 'https://example.com/webhook',
      })
      .expect(201);

    const endpoint = createResponse.body as EndpointPayload;

    // Act: POST to the ingestion endpoint
    const payload = { event: 'user.created', userId: 42 };
    const ingestResponse = await request(app.getHttpServer())
      .post(`/webhooks/${endpoint.id}`)
      .send(payload)
      .expect(202);

    const result = ingestResponse.body as IngestResponse;

    // Assert: response shape
    expect(result.event_id).toBeDefined();
    expect(result.trace_id).toBeDefined();
    expect(result.received_at).toBeDefined();
    expect(typeof result.received_at).toBe('string');

    // Assert: event exists in the database
    const eventRow = await dataSource.query(
      'SELECT id, endpoint_id, status, payload, trace_id FROM events WHERE id = $1',
      [result.event_id],
    );

    expect(eventRow).toHaveLength(1);
    expect(eventRow[0].endpoint_id).toBe(endpoint.id);
    expect(eventRow[0].status).toBe('received');
    expect(eventRow[0].trace_id).toBe(result.trace_id);
    expect(eventRow[0].payload).toEqual(payload);
  });

  it('returns 200 (via management API) and creates endpoint, then 202 on valid webhook', async () => {
    // Create endpoint
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/endpoints')
      .send({
        name: 'HMAC endpoint',
        destinationUrl: 'https://example.com/hmac',
        secret: 'whsec_test_secret',
      })
      .expect(201);

    const endpoint = createResponse.body as EndpointPayload;

    expect(endpoint.secret).toBe('whsec_test_secret');

    const payload = { data: 'hmac-test' };
    const rawBody = JSON.stringify(payload);
    const signature =
      'sha256=' + crypto.createHmac('sha256', 'whsec_test_secret').update(rawBody).digest('hex');

    // Act: POST with valid HMAC signature
    const ingestResponse = await request(app.getHttpServer())
      .post(`/webhooks/${endpoint.id}`)
      .set('X-Hub-Signature-256', signature)
      .send(payload)
      .expect(202);

    const result = ingestResponse.body as IngestResponse;

    expect(result.event_id).toBeDefined();
  });

  it('returns 400 when HMAC signature is invalid', async () => {
    // Create endpoint with secret
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/endpoints')
      .send({
        name: 'HMAC endpoint',
        destinationUrl: 'https://example.com/hmac',
        secret: 'whsec_test_secret',
      })
      .expect(201);

    const endpoint = createResponse.body as EndpointPayload;

    // Act: POST with invalid HMAC signature
    const payload = { data: 'test' };

    await request(app.getHttpServer())
      .post(`/webhooks/${endpoint.id}`)
      .set(
        'X-Hub-Signature-256',
        'sha256=0000000000000000000000000000000000000000000000000000000000000000',
      )
      .send(payload)
      .expect(400);
  });

  it('returns 400 when endpoint has secret but no signature header', async () => {
    // Create endpoint with secret
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/endpoints')
      .send({
        name: 'HMAC endpoint',
        destinationUrl: 'https://example.com/hmac',
        secret: 'whsec_test_secret',
      })
      .expect(201);

    const endpoint = createResponse.body as EndpointPayload;

    // Act: POST without signature header
    await request(app.getHttpServer())
      .post(`/webhooks/${endpoint.id}`)
      .send({ data: 'test' })
      .expect(400);
  });

  it('returns 404 for a non-existent endpoint', async () => {
    const fakeId = ulid();

    await request(app.getHttpServer())
      .post(`/webhooks/${fakeId}`)
      .send({ data: 'test' })
      .expect(404);
  });

  it('returns 409 for a paused endpoint', async () => {
    // Create an endpoint
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/endpoints')
      .send({
        name: 'Pause test endpoint',
        destinationUrl: 'https://example.com/pause-test',
      })
      .expect(201);

    const endpoint = createResponse.body as EndpointPayload;

    // Pause the endpoint
    await request(app.getHttpServer()).patch(`/api/v1/endpoints/${endpoint.id}/pause`).expect(200);

    // Act: POST to paused endpoint
    await request(app.getHttpServer())
      .post(`/webhooks/${endpoint.id}`)
      .send({ data: 'test' })
      .expect(409);
  });

  e2eSuite('SQS message verification', () => {
    let sqsClient: SQSClient;

    beforeAll(() => {
      sqsClient = new SQSClient({
        region: process.env['AWS_REGION'] ?? 'us-east-1',
        endpoint: process.env['AWS_ENDPOINT_URL'] ?? 'http://localhost:4566',
      });
    });

    it('publishes an ingestion message to the SQS queue', async () => {
      // Create endpoint
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/endpoints')
        .send({
          name: 'SQS test endpoint',
          destinationUrl: 'https://example.com/sqs-test',
        })
        .expect(201);

      const endpoint = createResponse.body as EndpointPayload;

      // Ingest
      const ingestResponse = await request(app.getHttpServer())
        .post(`/webhooks/${endpoint.id}`)
        .send({ msg: 'sqs-check' })
        .expect(202);

      const result = ingestResponse.body as IngestResponse;

      // Poll SQS for the message
      const queueUrl = process.env['SQS_INGESTION_QUEUE_URL']!;
      const receiveResponse = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 5,
        }),
      );

      expect(receiveResponse.Messages).toBeDefined();
      expect(receiveResponse.Messages).toHaveLength(1);

      const messageBody = JSON.parse(receiveResponse.Messages![0].Body!);

      expect(messageBody.event_id).toBe(result.event_id);
      expect(messageBody.endpoint_id).toBe(endpoint.id);
      expect(messageBody.trace_id).toBe(result.trace_id);
      expect(messageBody.received_at).toBe(result.received_at);
    });
  });
});
