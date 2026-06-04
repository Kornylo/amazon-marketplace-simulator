import { Module } from '@nestjs/common';
import { HealthController } from './common/health.controller';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { PricingModule } from './pricing/pricing.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { CatalogModule } from './catalog/catalog.module';
import { ReportsModule } from './reports/reports.module';
import { SellerCentralModule } from './seller-central/seller-central.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { MockUpdatesModule } from './mock-updates/mock-updates.module';
import { SeedModule } from './seed/seed.module';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    AuditModule,
    AuthModule,
    ListingsModule,
    PricingModule,
    InventoryModule,
    OrdersModule,
    CatalogModule,
    ReportsModule,
    SellerCentralModule,
    ScenariosModule,
    MockUpdatesModule,
    SeedModule,
  ],
})
export class AppModule {}
