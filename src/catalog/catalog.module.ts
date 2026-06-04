import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpApiGuard } from '../common/sp-api.guard';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [SpApiGuard,CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
