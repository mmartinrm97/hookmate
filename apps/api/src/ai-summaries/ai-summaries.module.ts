import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { AiSummariesController } from './ai-summaries.controller';
import { AiSummariesService } from './ai-summaries.service';
import { AiSummary } from './entities/ai-summary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiSummary]), EndpointsModule],
  controllers: [AiSummariesController],
  providers: [AiSummariesService],
  exports: [AiSummariesService],
})
export class AiSummariesModule {}
