import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EndpointsController } from './endpoints.controller.js';
import { EndpointsService } from './endpoints.service.js';
import { Endpoint } from './entities/endpoint.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Endpoint])],
  controllers: [EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}
