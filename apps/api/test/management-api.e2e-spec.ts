import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

process.env['POSTGRES_USER'] = process.env['POSTGRES_USER'] ?? 'hookmate';
process.env['POSTGRES_PASSWORD'] = process.env['POSTGRES_PASSWORD'] ?? 'hookmate';
process.env['POSTGRES_DB'] = process.env['POSTGRES_DB'] ?? 'hookmate';
process.env['API_KEYS'] = 'dev-key-123';

const isDbAvailable = !!process.env['POSTGRES_HOST'];

describe.skipIf(!isDbAvailable)('Management API (integration)', () => {
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

  const apiKey = 'dev-key-123';

  describe('Auth guard', () => {
    it('rejects unauthenticated requests with 401 on events endpoint', async () => {
      await request(app.getHttpServer()).get('/api/v1/events').expect(401);
    });

    it('rejects unauthenticated requests with 401 on metrics endpoint', async () => {
      await request(app.getHttpServer()).get('/api/v1/metrics/system').expect(401);
    });

    it('rejects requests with invalid API key with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/endpoints')
        .set('Authorization', 'Bearer invalid-key-123')
        .expect(401);
    });

    it('allows requests with valid API key', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/endpoints')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
    });
  });

  describe('Full lifecycle: endpoint → event → metrics', () => {
    let endpointId: string;

    it('creates an endpoint', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/endpoints')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          name: 'Integration test endpoint',
          destinationUrl: 'https://example.com/webhook',
        })
        .expect(201);

      endpointId = res.body.id;
      expect(res.body.status).toBe('active');
    });

    it('lists the created endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/endpoints')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty events list for the endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/events?endpointId=${endpointId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('returns system metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/metrics/system')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalEvents');
      expect(res.body).toHaveProperty('byStatus');
      expect(res.body).toHaveProperty('dlqDepth');
      expect(res.body).toHaveProperty('errorRate');
    });

    it('returns endpoint metrics (delivery data)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/metrics/endpoint/${endpointId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(res.body.endpointId).toBe(endpointId);
      expect(res.body.period).toBe('24h');
    });

    it('soft-deletes the endpoint and excludes it from list', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/endpoints/${endpointId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(204);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/endpoints')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      const ids = (listRes.body as Array<{ id: string }>).map((e: { id: string }) => e.id);
      expect(ids).not.toContain(endpointId);
    });
  });

  describe('DLQ event introspection', () => {
    it('returns empty DLQ list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dlq')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });
});

describe.skipIf(!isDbAvailable)('Module wiring (integration)', () => {
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

  it('verifies all management API endpoints exist', async () => {
    // All endpoints should return 401 without auth (proves they're registered)
    const routes = [
      '/api/v1/events',
      '/api/v1/dlq',
      '/api/v1/metrics/system',
      '/api/v1/metrics/endpoint/test-id',
      '/api/v1/endpoints',
    ];

    for (const route of routes) {
      await request(app.getHttpServer()).get(route).expect(401);
    }
  });
});
