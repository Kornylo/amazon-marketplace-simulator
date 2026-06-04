import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { SpApiGuard } from '../common/sp-api.guard';

@ApiTags('Inventory SP-API')
@ApiBearerAuth()
@UseGuards(SpApiGuard)
@Controller('fba/inventory/v1')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summaries')
  @ApiOperation({ summary: 'Get FBA inventory summaries' })
  @ApiQuery({ name: 'marketplaceIds', required: true })
  @ApiQuery({ name: 'sellerSkus', required: false })
  @ApiQuery({ name: 'details', required: false })
  @ApiQuery({ name: 'sellerId', required: false })
  async getSummaries(
    @Query('marketplaceIds') marketplaceIds: string,
    @Query('sellerSkus') sellerSkus: string,
    @Query('details') details: string,
    @Query('sellerId') sellerId: string,
  ) {
    const marketplace = Array.isArray(marketplaceIds)
      ? marketplaceIds[0]
      : String(marketplaceIds || 'ATVPDKIKX0DER');
    const skuList = sellerSkus
      ? String(sellerSkus).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    return this.inventoryService.getInventorySummaries({
      marketplaceId: marketplace,
      sellerSkus: skuList,
      sellerId,
      details: details === 'true',
    });
  }
}
