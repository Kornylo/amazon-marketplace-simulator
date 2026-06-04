import { Module } from '@nestjs/common';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ScenariosController],
  providers: [ScenariosService],
  exports: [ScenariosService],
})
export class ScenariosModule {}
