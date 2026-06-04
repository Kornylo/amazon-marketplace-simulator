import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpApiGuard } from '../common/sp-api.guard';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [SpApiGuard,ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
