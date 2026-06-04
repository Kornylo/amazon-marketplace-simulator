import { Controller, Post, Get, Param, Body, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SpApiGuard } from '../common/sp-api.guard';
import { Request } from 'express';

@ApiTags('Reports SP-API')
@ApiBearerAuth()
@UseGuards(SpApiGuard)
@Controller('reports/2021-06-30')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a report' })
  async createReport(@Body() body: any, @Req() req: any) {
    const sellerId = req.sellerId || 'A1MOCKSELLER123';
    return this.reportsService.createReport({
      reportType: body.reportType,
      marketplaceIds: body.marketplaceIds || ['ATVPDKIKX0DER'],
      sellerId,
      dataStartTime: body.dataStartTime,
      dataEndTime: body.dataEndTime,
    });
  }

  @Get('reports/:reportId')
  @ApiOperation({ summary: 'Get report status' })
  async getReport(@Param('reportId') reportId: string) {
    return this.reportsService.getReport(reportId);
  }

  @Get('documents/:documentId')
  @ApiOperation({ summary: 'Get report document' })
  async getReportDocument(@Param('documentId') documentId: string) {
    return this.reportsService.getReportDocument(documentId);
  }
}
