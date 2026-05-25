import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Database
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_DEFAULT_REGION: z.string().default('us-east-1'),
  AWS_ENDPOINT_URL: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // SQS
  SQS_INGESTION_QUEUE_URL: z.string().url().optional(),
  SQS_DLQ_URL: z.string().url().optional(),
  SQS_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),

  // SNS
  SNS_ALARM_TOPIC_ARN: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4o-mini'),

  // Auth
  API_KEYS: z.string().default('dev-key-123'),
  JWT_SECRET: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return result.data;
}
