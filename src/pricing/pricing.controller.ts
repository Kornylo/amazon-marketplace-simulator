import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { SpApiGuard } from '../common/sp-api.guard';

@ApiTags('Pricing SP-API')
@ApiBearerAuth()
@UseGuards(SpApiGuard)
@Controller('products/pricing/v0')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('price')
  @ApiOperation({ summary: 'Get pricing by ASINs' })
  @ApiQuery({ name: 'MarketplaceId', required: true })
  @ApiQuery({ name: 'Asins', required: true })
  async getPrice(
    @Query('MarketplaceId') marketplaceId: string,
    @Query('Asins') asins: string,
  ) {
    const asinList = String(asins).split(',').map((a) => a.trim()).filter(Boolean);
    return this.pricingService.getPriceByAsins(marketplaceId, asinList);
  }

  @Get('competitivePrice')
  @ApiOperation({ summary: 'Get competitive pricing by ASINs' })
  @ApiQuery({ name: 'MarketplaceId', required: true })
  @ApiQuery({ name: 'Asins', required: true })
  async getCompetitivePrice(
    @Query('MarketplaceId') marketplaceId: string,
    @Query('Asins') asins: string,
  ) {
    const asinList = String(asins).split(',').map((a) => a.trim()).filter(Boolean);
    return this.pricingService.getCompetitivePriceByAsins(marketplaceId, asinList);
  }
}
