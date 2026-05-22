import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  getRuntimeConfig(): AppRuntimeConfig {
    return {
      apiBasePath: this.apiBasePath,
      appEnv: this.configService.get<string>('NODE_ENV') ?? 'development',
      awsRegion:
        this.configService.get<string>('AWS_REGION') ??
        this.configService.get<string>('AWS_DEFAULT_REGION') ??
        'us-east-1',
      corsOrigin: this.configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
      port: this.getPort(),
      docsPath: this.docsPath,
      appVersion: this.configService.get<string>('npm_package_version') ?? '0.0.1',
    };
  }

  getPort(): number {
    const rawPort = this.configService.get<string>('PORT') ?? '3000';
    const port = Number.parseInt(rawPort, 10);

    return Number.isNaN(port) ? 3000 : port;
  }
}
