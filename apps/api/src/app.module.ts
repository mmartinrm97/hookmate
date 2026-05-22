import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module.js';
import { EndpointsModule } from './endpoints/endpoints.module.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';

@Module({
  imports: [CoreModule, EndpointsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
