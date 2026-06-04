import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { SpApiGuard } from '../common/sp-api.guard';

@ApiTags('Orders SP-API')
@ApiBearerAuth()
@UseGuards(SpApiGuard)
@Controller('orders/v0')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  @ApiOperation({ summary: 'List orders' })
  @ApiQuery({ name: 'MarketplaceIds', required: true })
  @ApiQuery({ name: 'OrderStatuses', required: false })
  @ApiQuery({ name: 'CreatedAfter', required: false })
  @ApiQuery({ name: 'CreatedBefore', required: false })
  @ApiQuery({ name: 'SellerId', required: false })
  async getOrders(
    @Query('MarketplaceIds') marketplaceIds: string,
    @Query('OrderStatuses') orderStatuses: string,
    @Query('CreatedAfter') createdAfter: string,
    @Query('CreatedBefore') createdBefore: string,
    @Query('SellerId') sellerId: string,
  ) {
    const marketplaceList = String(marketplaceIds || 'ATVPDKIKX0DER')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const statusList = orderStatuses
      ? String(orderStatuses).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    return this.ordersService.getOrders({
      marketplaceIds: marketplaceList,
      orderStatuses: statusList,
      sellerId,
      createdAfter,
      createdBefore,
    });
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('orderId') orderId: string) {
    return this.ordersService.getOrder(orderId);
  }

  @Get('orders/:orderId/orderItems')
  @ApiOperation({ summary: 'Get order items' })
  async getOrderItems(@Param('orderId') orderId: string) {
    return this.ordersService.getOrderItems(orderId);
  }
}
