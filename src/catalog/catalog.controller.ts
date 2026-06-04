import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { SpApiGuard } from '../common/sp-api.guard';

@ApiTags('Catalog SP-API')
@ApiBearerAuth()
@UseGuards(SpApiGuard)
@Controller('catalog/2022-04-01/items')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Search catalog items' })
  @ApiQuery({ name: 'marketplaceIds', required: true })
  @ApiQuery({ name: 'identifiers', required: false })
  @ApiQuery({ name: 'identifierType', required: false })
  @ApiQuery({ name: 'keywords', required: false })
  @ApiQuery({ name: 'includedData', required: false })
  async searchItems(
    @Query('marketplaceIds') marketplaceIds: string,
    @Query('identifiers') identifiers: string,
    @Query('identifierType') identifierType: string,
    @Query('keywords') keywords: string,
    @Query('includedData') includedData: string,
  ) {
    const marketplaceList = String(marketplaceIds || 'ATVPDKIKX0DER')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const identifierList = identifiers
      ? String(identifiers).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    return this.catalogService.searchItems({
      marketplaceIds: marketplaceList,
      identifiers: identifierList,
      identifierType,
      keywords,
      includedData,
    });
  }

  @Get(':asin')
  @ApiOperation({ summary: 'Get catalog item by ASIN' })
  @ApiQuery({ name: 'marketplaceIds', required: true })
  async getItem(
    @Param('asin') asin: string,
    @Query('marketplaceIds') marketplaceIds: string,
  ) {
    const marketplaceList = String(marketplaceIds || 'ATVPDKIKX0DER')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.catalogService.getItem(asin, marketplaceList);
  }
}
