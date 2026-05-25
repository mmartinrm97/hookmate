import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
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

describe.skipIf(!process.env.POSTGRES_HOST)('Database schema (e2e)', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM ai_summaries');
    await dataSource.query('DELETE FROM dlq_events');
    await dataSource.query('DELETE FROM delivery_attempts');
    await dataSource.query('DELETE FROM routing_rules');
    await dataSource.query('DELETE FROM events');
    await dataSource.query('DELETE FROM endpoints');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('verifies all tables exist via entity metadata', () => {
    const entityNames = dataSource.entityMetadatas.map((m) => m.tableName).sort();
    expect(entityNames).toContain('endpoints');
    expect(entityNames).toContain('events');
    expect(entityNames).toContain('delivery_attempts');
    expect(entityNames).toContain('dlq_events');
    expect(entityNames).toContain('routing_rules');
    expect(entityNames).toContain('ai_summaries');
  });

  it('can insert and read an event with FK to endpoint', async () => {
    const endpointRepo = dataSource.getRepository('Endpoint');
    const endpoint = endpointRepo.create({
      id: '01TESTENDPOINT000000001',
      name: 'Test endpoint',
      destinationUrl: 'https://example.com/webhook',
    });
    await endpointRepo.save(endpoint);

    const eventRepo = dataSource.getRepository('Event');
    const event = eventRepo.create({
      id: '01TESTEVENT000000000001',
      endpointId: endpoint,
      payload: { type: 'test', data: 'hello' },
      status: 'received',
    });
    await eventRepo.save(event);

    const found = await eventRepo.findOne({ where: { id: event.id } });
    expect(found).toBeDefined();
    expect(found?.payload).toEqual({ type: 'test', data: 'hello' });
  });

  it('enforces FK constraint on events (cannot create event without endpoint)', async () => {
    const eventRepo = dataSource.getRepository('Event');
    const event = eventRepo.create({
      id: '01TESTEVENT000000000002',
      endpointId: { id: '01NONEXISTENT0000000000' } as never,
      payload: { type: 'test' },
      status: 'received',
    });

    await expect(eventRepo.save(event)).rejects.toThrow();
  });
});
