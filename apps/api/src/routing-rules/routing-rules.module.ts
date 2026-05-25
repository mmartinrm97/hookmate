import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { RoutingRulesController } from './routing-rules.controller';
import { RoutingRule } from './entities/routing-rule.entity';
import { RoutingRulesService } from './routing-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoutingRule]), EndpointsModule],
  controllers: [RoutingRulesController],
  providers: [RoutingRulesService],
  exports: [RoutingRulesService],
})
export class RoutingRulesModule {}
