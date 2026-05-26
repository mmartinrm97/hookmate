/**
 * Seed script: creates 1 test endpoint + 20 test events in various statuses.
 *
 * Usage:
 *   pnpm --filter @hookmate/api exec ts-node scripts/seed.ts
 *
 * Requires: PostgreSQL running, DATABASE_URL or POSTGRES_* env vars set.
 */
import { DataSource } from 'typeorm';
import { Endpoint } from '../src/endpoints/entities/endpoint.entity';
import { Event } from '../src/events/entities/event.entity';
import { RoutingRule } from '../src/routing-rules/entities/routing-rule.entity';
import { DeliveryAttempt } from '../src/delivery-attempts/entities/delivery-attempt.entity';
import { DlqEvent } from '../src/dlq-events/entities/dlq-event.entity';
import { AiSummary } from '../src/ai-summaries/entities/ai-summary.entity';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
    username: process.env.POSTGRES_USER || 'hookmate',
    password: process.env.POSTGRES_PASSWORD || 'hookmate',
    database: process.env.POSTGRES_DB || 'hookmate',
    entities: [Endpoint, Event, RoutingRule, DeliveryAttempt, DlqEvent, AiSummary],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Connected to database');

  const endpointRepo = dataSource.getRepository(Endpoint);
  const eventRepo = dataSource.getRepository(Event);
  const ruleRepo = dataSource.getRepository(RoutingRule);

  // Clear existing data (in reverse dependency order using CASCADE)
  await dataSource.query(
    'TRUNCATE TABLE delivery_attempts, dlq_events, ai_summaries, events, routing_rules, endpoints CASCADE',
  );
  console.log('🧹 Cleared existing data');

  // Create test endpoint
  const endpoint = endpointRepo.create({
    name: 'Test Endpoint',
    destinationUrl: 'https://webhook.site/test-123',
    secret: 'test-secret-key',
    status: 'active',
    maxRetries: 5,
    retryBaseDelayMs: 5000,
    dlqThreshold: 100,
  });
  await endpointRepo.save(endpoint);
  console.log(`✅ Created endpoint: ${endpoint.id}`);

  // Create routing rule
  const rule = ruleRepo.create({
    endpointId: endpoint,
    priority: 1,
    matchType: 'header',
    matchKey: 'x-event-type',
    matchValue: 'payment',
    destinationType: 'http',
    destinationUrl: 'https://webhook.site/test-123',
  });
  await ruleRepo.save(rule);
  console.log(`✅ Created routing rule: ${rule.id}`);

  // Create 20 test events with various statuses
  const statuses: Array<'received' | 'processing' | 'delivered' | 'failed' | 'dead_lettered'> = [
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'processing',
    'processing',
    'processing',
    'failed',
    'failed',
    'received',
    'received',
    'dead_lettered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
  ];

  const categories = ['payment', 'user.signup', 'order.created', 'notification', 'system'];
  const events: Event[] = [];

  for (let i = 0; i < 20; i++) {
    const event = eventRepo.create({
      endpointId: endpoint,
      payload: {
        event: categories[i % categories.length],
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        data: { message: `Test event ${i + 1}` },
      },
      headers: {
        'content-type': 'application/json',
        'x-event-type': categories[i % categories.length],
        'x-request-id': `req-${String(i + 1).padStart(3, '0')}`,
      },
      sourceIp: `192.168.1.${100 + i}`,
      status: statuses[i],
      category: categories[i % categories.length],
      traceId: `trace-${String(i + 1).padStart(3, '0')}-ulid`,
    });
    events.push(event);
  }

  await eventRepo.save(events);
  console.log(
    `✅ Created ${events.length} events (${statuses.filter((s) => s === 'delivered').length} delivered, ${statuses.filter((s) => s === 'failed').length} failed, ${statuses.filter((s) => s === 'received').length} received, ${statuses.filter((s) => s === 'processing').length} processing, ${statuses.filter((s) => s === 'dead_lettered').length} dead_lettered)`,
  );

  await dataSource.destroy();
  console.log('✅ Seed complete');
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
