import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { SellerCentralService } from './seller-central.service';

@ApiTags('Seller Central (Internal)')
@Controller('seller-central')
export class SellerCentralController {
  constructor(private readonly sellerCentralService: SellerCentralService) {}

  @Post('actions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a Seller Central action' })
  async createAction(@Body() body: any) {
    return this.sellerCentralService.createAction(body);
  }

  @Get('actions')
  @ApiOperation({ summary: 'List Seller Central actions' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'sellerId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getActions(
    @Query('type') type: string,
    @Query('status') status: string,
    @Query('sellerId') sellerId: string,
    @Query('limit') limit: string,
  ) {
    return this.sellerCentralService.getActions({
      type,
      status,
      sellerId,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get('actions/:actionId')
  @ApiOperation({ summary: 'Get a specific action' })
  async getAction(@Param('actionId') actionId: string) {
    return this.sellerCentralService.getAction(actionId);
  }

  @Get('actions/:actionId/events')
  @ApiOperation({ summary: 'Get action event history' })
  async getActionEvents(@Param('actionId') actionId: string) {
    return this.sellerCentralService.getActionEvents(actionId);
  }

  @Post('actions/:actionId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually approve an action' })
  async approveAction(@Param('actionId') actionId: string, @Body() body: any) {
    return this.sellerCentralService.approveAction(actionId, body?.reason);
  }

  @Post('actions/:actionId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually reject an action' })
  async rejectAction(@Param('actionId') actionId: string, @Body() body: any) {
    return this.sellerCentralService.rejectAction(actionId, body?.reason || 'Rejected by engineer');
  }

  @Get('policies')
  @ApiOperation({ summary: 'Get SC action policies' })
  async getPolicies() {
    return this.sellerCentralService.getPolicies();
  }

  @Post('policies')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert SC action policy' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        actionType: { type: 'string' },
        policy: { type: 'string', enum: ['APPROVE_ONLY_VALID', 'REQUIRE_MANUAL_APPROVAL', 'AUTO_APPROVE'] },
      },
    },
  })
  async upsertPolicy(@Body() body: any) {
    return this.sellerCentralService.upsertPolicy(body.actionType, body.policy);
  }
}
