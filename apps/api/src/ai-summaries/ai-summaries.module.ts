import { BullModule, InjectQueue } from '@nestjs/bull';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { EventsModule } from '../events/events.module';
import { AiSummariesController } from './ai-summaries.controller';
import { AiSummariesService } from './ai-summaries.service';
import { AiSummariesConsumer } from './ai-summaries.consumer';
import { AiProcessorService } from './ai-processor.service';
import { AiSummary } from './entities/ai-summary.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiSummary]),
    BullModule.registerQueue({ name: 'ai-summaries' }),
    EndpointsModule,
    EventsModule,
  ],
  controllers: [AiSummariesController],
  providers: [AiSummariesService, AiProcessorService, AiSummariesConsumer],
  exports: [AiSummariesService],
})
export class AiSummariesModule implements OnModuleInit {
  private readonly logger = new Logger(AiSummariesModule.name);

  constructor(
    @InjectQueue('ai-summaries')
    private readonly aiSummariesQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register repeatable scheduled job every 30 minutes
    await this.aiSummariesQueue.add(
      'generate-summary',
      { jobType: 'scheduled' },
      {
        repeat: { cron: '*/30 * * * *' },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Registered AI summary scheduled job (every 30 minutes)');
  }
}
