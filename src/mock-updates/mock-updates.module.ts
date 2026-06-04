import { Module } from '@nestjs/common';
import { MockUpdatesController } from './mock-updates.controller';
import { MockUpdatesService } from './mock-updates.service';

@Module({
  controllers: [MockUpdatesController],
  providers: [MockUpdatesService],
  exports: [MockUpdatesService],
})
export class MockUpdatesModule {}
