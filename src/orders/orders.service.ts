import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class OrdersService {
  constructor(private readonly db: DatabaseService) {}

  async getOrders(params: {
    marketplaceIds: string[];
    orderStatuses?: string[];
    sellerId?: string;
    createdAfter?: string;
    createdBefore?: string;
  }): Promise<any> {
    let query = `SELECT * FROM sim_orders WHERE marketplace_id = ANY($1)`;
    const values: any[] = [params.marketplaceIds];

    if (params.sellerId) {
      query += ` AND seller_id = $${values.length + 1}`;
      values.push(params.sellerId);
    }

    if (params.orderStatuses && params.orderStatuses.length > 0) {
      query += ` AND status = ANY($${values.length + 1})`;
      values.push(params.orderStatuses);
    }

    if (params.createdAfter) {
      query += ` AND purchase_date >= $${values.length + 1}`;
      values.push(params.createdAfter);
    }

    if (params.createdBefore) {
      query += ` AND purchase_date <= $${values.length + 1}`;
      values.push(params.createdBefore);
    }

    query += ' ORDER BY purchase_date DESC LIMIT 200';

    const rows = await this.db.queryMany(query, values);
    return {
      payload: {
        Orders: rows.map((r) => this.formatOrder(r)),
        NextToken: null,
      },
    };
  }

  async getOrder(orderId: string): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT * FROM sim_orders WHERE amazon_order_id = $1`,
      [orderId],
    );

    if (!row) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    return { payload: this.formatOrder(row) };
  }

  async getOrderItems(orderId: string): Promise<any> {
    const items = await this.db.queryMany(
      `SELECT * FROM sim_order_items WHERE amazon_order_id = $1`,
      [orderId],
    );

    return {
      payload: {
        OrderItems: items.map((item) => ({
          ASIN: item.asin,
          SellerSKU: item.sku,
          OrderItemId: item.id,
          Title: item.title,
          QuantityOrdered: item.quantity_ordered,
          QuantityShipped: item.quantity_shipped,
          ItemPrice: item.item_price,
        })),
        AmazonOrderId: orderId,
      },
    };
  }

  private formatOrder(row: any): any {
    return {
      AmazonOrderId: row.amazon_order_id,
      PurchaseDate: row.purchase_date,
      LastUpdateDate: row.last_updated_date,
      OrderStatus: row.status,
      MarketplaceId: row.marketplace_id,
      SellerId: row.seller_id,
      OrderTotal: row.order_total,
      ShipServiceLevel: row.ship_service_level,
    };
  }
}
