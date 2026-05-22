import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingRule } from './entities/routing-rule.entity';
import { RoutingRulesService } from './routing-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoutingRule])],
  providers: [RoutingRulesService],
  exports: [RoutingRulesService],
})
export class RoutingRulesModule {}
