import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  async getInventorySummaries(params: {
    marketplaceId: string;
    sellerSkus?: string[];
    sellerId?: string;
    details?: boolean;
  }): Promise<any> {
    let query = `SELECT i.*, l.title FROM sim_inventory i
                 LEFT JOIN sim_listings l ON l.sku = i.sku AND l.marketplace_id = i.marketplace_id
                 WHERE i.marketplace_id = $1`;
    const values: any[] = [params.marketplaceId];

    if (params.sellerId) {
      query += ` AND i.seller_id = $${values.length + 1}`;
      values.push(params.sellerId);
    }

    if (params.sellerSkus && params.sellerSkus.length > 0) {
      query += ` AND i.sku = ANY($${values.length + 1})`;
      values.push(params.sellerSkus);
    }

    query += ' ORDER BY i.sku';

    const rows = await this.db.queryMany(query, values);

    const inventorySummaries = rows.map((row) => {
      const summary: any = {
        sellerSku: row.sku,
        asin: row.asin,
        fnSku: `X${row.asin}`,
        productName: row.title || '',
        condition: 'NewItem',
        lastUpdatedTime: row.updated_at,
        fulfillableQuantity: row.fulfillable_quantity,
      };

      if (params.details) {
        summary.inventoryDetails = {
          fulfillableQuantity: row.fulfillable_quantity,
          inboundWorkingQuantity: row.inbound_working_quantity,
          inboundShippedQuantity: row.inbound_shipped_quantity,
          inboundReceivingQuantity: row.inbound_receiving_quantity,
          reservedQuantity: {
            totalReservedQuantity: row.reserved_fc_processing,
            pendingCustomerOrderQuantity: 0,
            pendingTransshipmentQuantity: 0,
            fcProcessingQuantity: row.reserved_fc_processing,
          },
        };
      }

      return summary;
    });

    return {
      payload: {
        granularity: { granularityType: 'Marketplace', granularityId: params.marketplaceId },
        inventorySummaries,
      },
    };
  }
}
