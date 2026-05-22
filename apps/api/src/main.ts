import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { AppConfigService } from './core/config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const appConfigService = app.get(AppConfigService);
  const runtimeConfig = appConfigService.getRuntimeConfig();

  await configureApp(app);
  await app.listen(runtimeConfig.port, '0.0.0.0');
}
bootstrap().catch(console.error);
