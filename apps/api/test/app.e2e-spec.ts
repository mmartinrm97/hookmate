import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app.js';

// Provide safe defaults so the module config does not throw.
// Postgres must be running (via docker-compose) for e2e tests.
process.env['POSTGRES_USER'] = process.env['POSTGRES_USER'] ?? 'hookmate';
process.env['POSTGRES_PASSWORD'] = process.env['POSTGRES_PASSWORD'] ?? 'hookmate';
process.env['POSTGRES_DB'] = process.env['POSTGRES_DB'] ?? 'hookmate';

interface HealthPayload {
  service: string;
  status: string;
}

interface EndpointPayload {
  destinationUrl: string;
  id: string;
  name: string;
  status: string;
}

const isDbAvailable = !!process.env['POSTGRES_HOST'];

describe.skipIf(!isDbAvailable)('API bootstrap (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('/api/v1/health (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    const payload = response.body as HealthPayload;

    expect(payload.service).toBe('hookmate-api');
    expect(payload.status).toBe('ok');
  });

  it('/api/v1/endpoints CRUD lifecycle', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/endpoints')
      .send({
        name: 'Billing endpoint',
        destinationUrl: 'https://example.com/webhooks/billing',
      })
      .expect(201);

    const createdEndpoint = createResponse.body as EndpointPayload;

    expect(createdEndpoint.name).toBe('Billing endpoint');
    expect(createdEndpoint.status).toBe('active');

    const listResponse = await request(app.getHttpServer()).get('/api/v1/endpoints').expect(200);

    const endpoints = listResponse.body as EndpointPayload[];

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]?.id).toBe(createdEndpoint.id);

    const pauseResponse = await request(app.getHttpServer())
      .patch(`/api/v1/endpoints/${createdEndpoint.id}/pause`)
      .expect(200);

    expect((pauseResponse.body as EndpointPayload).status).toBe('paused');

    const resumeResponse = await request(app.getHttpServer())
      .patch(`/api/v1/endpoints/${createdEndpoint.id}/resume`)
      .expect(200);

    expect((resumeResponse.body as EndpointPayload).status).toBe('active');
  });
});
