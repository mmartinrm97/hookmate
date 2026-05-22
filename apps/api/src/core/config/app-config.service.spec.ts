import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AppConfigService } from './app-config.service';
import type { Env } from './env.schema';

describe('AppConfigService', () => {
  describe('getDatabaseConfig', () => {
    const createMockConfigService = (overrides: Record<string, unknown> = {}) => {
      const defaults: Record<string, unknown> = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_PORT: 5432,
        POSTGRES_USER: 'hookmate',
        POSTGRES_PASSWORD: 'hookmate',
        POSTGRES_DB: 'hookmate',
        ...overrides,
      };

      return {
        get: vi.fn((key: string) => defaults[key]),
        getOrThrow: vi.fn((key: string) => {
          if (key in defaults) return defaults[key];
          throw new Error(`Config key "${key}" not found`);
        }),
      } as unknown as ConfigService<Env, true>;
    };

    it('returns TypeOrmModuleOptions with postgres driver and defaults', () => {
      const mockConfigService = createMockConfigService();
      const service = new AppConfigService(mockConfigService);
      const config = service.getDatabaseConfig();

      expect(config).toMatchObject({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'hookmate',
        password: 'hookmate',
        database: 'hookmate',
        synchronize: true,
        logging: false,
      });
    });

    it('reads custom host and port from environment variables', () => {
      const mockConfigService = createMockConfigService({
        POSTGRES_HOST: 'pg.example.com',
        POSTGRES_PORT: 6543,
      });
      const service = new AppConfigService(mockConfigService);
      const config = service.getDatabaseConfig() as Record<string, unknown>;

      expect(config.host).toBe('pg.example.com');
      expect(config.port).toBe(6543);
    });

    it('reads custom credentials from environment variables', () => {
      const mockConfigService = createMockConfigService({
        POSTGRES_USER: 'admin',
        POSTGRES_PASSWORD: 's3cret',
        POSTGRES_DB: 'myapp',
      });
      const service = new AppConfigService(mockConfigService);
      const config = service.getDatabaseConfig() as Record<string, unknown>;

      expect(config.username).toBe('admin');
      expect(config.password).toBe('s3cret');
      expect(config.database).toBe('myapp');
    });
  });
});
