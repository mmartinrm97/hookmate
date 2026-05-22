import helmet from '@fastify/helmet';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from './core/config/app-config.service';

export async function configureApp(app: INestApplication): Promise<void> {
  const appConfigService = app.get(AppConfigService);
  const runtimeConfig = appConfigService.getRuntimeConfig();
  const fastifyApp = app as NestFastifyApplication;

  await fastifyApp.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  app.enableCors({
    origin: runtimeConfig.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix(runtimeConfig.apiBasePath);
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
    defaultVersion: '1',
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HookMate API')
    .setDescription('Webhook infrastructure management API for HookMate')
    .setVersion(runtimeConfig.appVersion)
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Use Bearer <token> for authenticated management endpoints.',
      },
      'apiKey',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(runtimeConfig.docsPath, app, document);
}
