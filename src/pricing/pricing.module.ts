import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpApiGuard } from '../common/sp-api.guard';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthModule],
  controllers: [PricingController],
  providers: [SpApiGuard,PricingService],
  exports: [PricingService],
})
export class PricingModule {}
