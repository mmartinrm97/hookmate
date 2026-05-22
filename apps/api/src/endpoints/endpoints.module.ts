import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { Endpoint } from './entities/endpoint.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Endpoint])],
  controllers: [EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}
