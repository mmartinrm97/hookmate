import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from './config/app-config.service.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: ['apps/api/.env', 'apps/api/.env.example', '.env', '.env.example'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (appConfigService: AppConfigService) => appConfigService.getDatabaseConfig(),
      inject: [AppConfigService],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class CoreModule {}
