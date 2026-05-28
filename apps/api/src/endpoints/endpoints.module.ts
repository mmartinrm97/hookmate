import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { Endpoint } from './entities/endpoint.entity';

@Module({
  imports: [CircuitBreakerModule, TypeOrmModule.forFeature([Endpoint])],
  controllers: [EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}
