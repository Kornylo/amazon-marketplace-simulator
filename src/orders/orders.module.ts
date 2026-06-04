import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpApiGuard } from '../common/sp-api.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController],
  providers: [SpApiGuard,OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
