import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from './config/app-config.service';
import { CoreModule } from './core.module';

describe('CoreModule', () => {
  beforeAll(() => {
    process.env.POSTGRES_USER = 'test_user';
    process.env.POSTGRES_PASSWORD = 'test_pass';
    process.env.POSTGRES_DB = 'test_db';
  });

  afterAll(() => {
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.POSTGRES_DB;
  });

  it('compiles with TypeOrmModule wired and provides AppConfigService', async () => {
    const dataSourceMock = { initialize: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSourceMock)
      .compile();

    const appConfigService = moduleRef.get(AppConfigService);
    expect(appConfigService).toBeInstanceOf(AppConfigService);
    expect(appConfigService.getDatabaseConfig().type).toBe('postgres');
  });
});
