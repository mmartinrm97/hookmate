import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryAttemptsService } from './delivery-attempts.service';
import { DeliveryAttempt } from './entities/delivery-attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryAttempt])],
  providers: [DeliveryAttemptsService],
  exports: [DeliveryAttemptsService],
})
export class DeliveryAttemptsModule {}
