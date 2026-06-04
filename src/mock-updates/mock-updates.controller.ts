import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MockUpdatesService } from './mock-updates.service';

@ApiTags('Mock Updates (Internal)')
@Controller('mock/updates')
export class MockUpdatesController {
  constructor(private readonly mockUpdatesService: MockUpdatesService) {}

  @Get()
  @ApiOperation({ summary: 'List mock update submissions' })
  @ApiQuery({ name: 'sellerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getUpdates(
    @Query('sellerId') sellerId: string,
    @Query('status') status: string,
    @Query('limit') limit: string,
  ) {
    return this.mockUpdatesService.getUpdates({
      sellerId,
      status,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get(':submissionId')
  @ApiOperation({ summary: 'Get a specific mock update' })
  async getUpdate(@Param('submissionId') submissionId: string) {
    return this.mockUpdatesService.getUpdate(submissionId);
  }

  @Get(':submissionId/events')
  @ApiOperation({ summary: 'Get events for a mock update' })
  async getUpdateEvents(@Param('submissionId') submissionId: string) {
    return this.mockUpdatesService.getUpdateEvents(submissionId);
  }
}
