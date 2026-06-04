import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { SpApiGuard } from '../common/sp-api.guard';
import { Request } from 'express';

@ApiTags('Listings SP-API')
@ApiBearerAuth()
@UseGuards(SpApiGuard)
@Controller('listings/2021-08-01/items')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get(':sellerId')
  @ApiOperation({ summary: 'Get all listings for a seller' })
  @ApiQuery({ name: 'marketplaceIds', required: true })
  @ApiQuery({ name: 'includedData', required: false })
  async getListings(
    @Param('sellerId') sellerId: string,
    @Query('marketplaceIds') marketplaceIds: string,
    @Query('includedData') includedData: string,
  ) {
    const marketplace = Array.isArray(marketplaceIds)
      ? marketplaceIds[0]
      : String(marketplaceIds || 'ATVPDKIKX0DER');
    return this.listingsService.getListings(sellerId, marketplace, includedData);
  }

  @Get(':sellerId/:sku')
  @ApiOperation({ summary: 'Get a single listing by SKU' })
  @ApiQuery({ name: 'marketplaceIds', required: true })
  @ApiQuery({ name: 'includedData', required: false })
  async getListing(
    @Param('sellerId') sellerId: string,
    @Param('sku') sku: string,
    @Query('marketplaceIds') marketplaceIds: string,
    @Query('includedData') includedData: string,
  ) {
    const marketplace = Array.isArray(marketplaceIds)
      ? marketplaceIds[0]
      : String(marketplaceIds || 'ATVPDKIKX0DER');
    return this.listingsService.getListing(sellerId, sku, marketplace, includedData);
  }

  @Patch(':sellerId/:sku')
  @ApiOperation({ summary: 'Patch a listing' })
  @ApiQuery({ name: 'marketplaceIds', required: true })
  async patchListing(
    @Param('sellerId') sellerId: string,
    @Param('sku') sku: string,
    @Query('marketplaceIds') marketplaceIds: string,
    @Body() body: any,
  ) {
    const marketplace = Array.isArray(marketplaceIds)
      ? marketplaceIds[0]
      : String(marketplaceIds || 'ATVPDKIKX0DER');
    return this.listingsService.patchListing(sellerId, sku, marketplace, body);
  }
}
