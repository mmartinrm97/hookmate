import { DataSource } from 'typeorm';
import { AiSummary } from '../ai-summaries/entities/ai-summary.entity';
import { DeliveryAttempt } from '../delivery-attempts/entities/delivery-attempt.entity';
import { DlqEvent } from '../dlq-events/entities/dlq-event.entity';
import { Endpoint } from '../endpoints/entities/endpoint.entity';
import { Event } from '../events/entities/event.entity';
import { RoutingRule } from '../routing-rules/entities/routing-rule.entity';
import { SnakeCaseNamingStrategy } from './naming-strategy';

export default new DataSource({
  type: 'postgres',
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
  username: process.env['POSTGRES_USER'] ?? 'hookmate',
  password: process.env['POSTGRES_PASSWORD'] ?? 'hookmate',
  database: process.env['POSTGRES_DB'] ?? 'hookmate',
  synchronize: false,
  entities: [Endpoint, Event, DeliveryAttempt, DlqEvent, RoutingRule, AiSummary],
  migrations: ['src/database/migrations/*.ts'],
  namingStrategy: new SnakeCaseNamingStrategy(),
});
