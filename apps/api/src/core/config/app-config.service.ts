import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Env } from './env.schema';

export interface AppRuntimeConfig {
  apiBasePath: string;
  appEnv: string;
  awsRegion: string;
  corsOrigin: string;
  port: number;
  docsPath: string;
  appVersion: string;
}

@Injectable()
export class AppConfigService {
  readonly apiBasePath = 'api';
  readonly docsPath = 'api/docs';

  constructor(@Inject(ConfigService) private readonly configService: ConfigService<Env, true>) {}

  getRuntimeConfig(): AppRuntimeConfig {
    return {
      apiBasePath: this.apiBasePath,
      appEnv: this.configService.get('NODE_ENV'),
      awsRegion: this.configService.get('AWS_REGION'),
      corsOrigin: this.configService.get('CORS_ORIGIN'),
      port: this.configService.get('PORT'),
      docsPath: this.docsPath,
      appVersion: process.env['npm_package_version'] ?? '0.0.1',
    };
  }

  getPort(): number {
    return this.configService.get('PORT');
  }

  getDatabaseConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get('POSTGRES_HOST'),
      port: this.configService.get('POSTGRES_PORT'),
      username: this.configService.get('POSTGRES_USER'),
      password: this.configService.get('POSTGRES_PASSWORD'),
      database: this.configService.get('POSTGRES_DB'),
      synchronize: true,
      logging: false,
      autoLoadEntities: true,
    };
  }
}
