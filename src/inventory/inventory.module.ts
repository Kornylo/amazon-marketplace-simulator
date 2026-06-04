import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpApiGuard } from '../common/sp-api.guard';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [SpApiGuard,InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
