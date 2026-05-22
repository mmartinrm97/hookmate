import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app.js';

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

describe('API bootstrap (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        const payload = body as HealthPayload;

        expect(payload.service).toBe('hookmate-api');
        expect(payload.status).toBe('ok');
      });
  });

  it('/api/endpoints (POST -> GET -> PATCH)', async () => {
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
  });
});
