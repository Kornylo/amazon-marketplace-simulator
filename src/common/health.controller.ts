import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  async health() {
    let dbOk = false;
    try {
      await this.db.queryOne('SELECT 1');
      dbOk = true;
    } catch (_) {}

    return {
      status: 'ok',
      service: 'amazon-marketplace-simulator',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      db: dbOk ? 'connected' : 'disconnected',
    };
  }
}
