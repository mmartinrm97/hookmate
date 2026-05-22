import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSummariesService } from './ai-summaries.service';
import { AiSummary } from './entities/ai-summary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiSummary])],
  providers: [AiSummariesService],
  exports: [AiSummariesService],
})
export class AiSummariesModule {}
