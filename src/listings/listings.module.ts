import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpApiGuard } from '../common/sp-api.guard';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule,AuditModule],
  controllers: [ListingsController],
  providers: [SpApiGuard,ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
