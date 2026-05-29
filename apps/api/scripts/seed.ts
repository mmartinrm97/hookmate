/**
 * Seed script: creates 3 test endpoints + 50 test events + 2 routing rules.
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

  // Create 3 test endpoints
  const endpoints = [
    {
      name: 'GitHub Webhooks',
      destinationUrl: 'https://webhook.site/github-123',
      secret: 'whsec_github_secret',
      status: 'active' as const,
      maxRetries: 5,
      retryBaseDelayMs: 5000,
      dlqThreshold: 100,
    },
    {
      name: 'Stripe Payments',
      destinationUrl: 'https://webhook.site/stripe-456',
      secret: 'whsec_stripe_secret',
      status: 'active' as const,
      maxRetries: 3,
      retryBaseDelayMs: 10000,
      dlqThreshold: 50,
    },
    {
      name: 'Shopify Orders',
      destinationUrl: 'https://webhook.site/shopify-789',
      secret: 'whsec_shopify_secret',
      status: 'active' as const,
      maxRetries: 5,
      retryBaseDelayMs: 5000,
      dlqThreshold: 100,
    },
  ];

  const savedEndpoints: Endpoint[] = [];
  for (const ep of endpoints) {
    const endpoint = endpointRepo.create(ep);
    await endpointRepo.save(endpoint);
    savedEndpoints.push(endpoint);
    console.log(`✅ Created endpoint: ${endpoint.name} (${endpoint.id})`);
  }

  // Create 2 routing rules
  const rules = [
    {
      endpointId: savedEndpoints[0],
      priority: 1,
      matchType: 'header' as const,
      matchKey: 'x-event-type',
      matchValue: 'payment',
      destinationType: 'http' as const,
      destinationUrl: 'https://webhook.site/payments',
    },
    {
      endpointId: savedEndpoints[1],
      priority: 1,
      matchType: 'json_path' as const,
      matchKey: '$.type',
      matchValue: 'invoice',
      destinationType: 'http' as const,
      destinationUrl: 'https://webhook.site/invoices',
    },
  ];

  for (const ruleData of rules) {
    const rule = ruleRepo.create(ruleData);
    await ruleRepo.save(rule);
    console.log(`✅ Created routing rule: ${rule.matchKey} → ${rule.destinationUrl}`);
  }

  // Create 50 test events with various statuses across all endpoints
  const statuses: Array<'received' | 'processing' | 'delivered' | 'failed' | 'dead_lettered'> = [
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
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
    'processing',
    'processing',
    'failed',
    'failed',
    'failed',
    'received',
    'received',
    'received',
    'received',
    'received',
    'dead_lettered',
    'dead_lettered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'delivered',
    'failed',
    'failed',
    'processing',
    'processing',
    'received',
  ];

  const categories = ['payment', 'user.signup', 'order.created', 'notification', 'system'];
  const events: Event[] = [];

  for (let i = 0; i < 50; i++) {
    const endpoint = savedEndpoints[i % savedEndpoints.length];
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
      sourceIp: `192.168.1.${100 + (i % 50)}`,
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
