import { Module } from '@nestjs/common';
import { SellerCentralController } from './seller-central.controller';
import { SellerCentralService } from './seller-central.service';
import { SellerCentralValidationService } from './seller-central-validation.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SellerCentralController],
  providers: [SellerCentralService, SellerCentralValidationService],
  exports: [SellerCentralService, SellerCentralValidationService],
})
export class SellerCentralModule {}
