import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  async searchItems(params: {
    marketplaceIds: string[];
    identifiers?: string[];
    identifierType?: string;
    keywords?: string;
    includedData?: string;
  }): Promise<any> {
    let rows: any[] = [];

    if (params.identifiers && params.identifiers.length > 0) {
      if (params.identifierType === 'ASIN') {
        rows = await this.db.queryMany(
          `SELECT * FROM sim_catalog WHERE asin = ANY($1) ORDER BY asin`,
          [params.identifiers],
        );
      } else if (params.identifierType === 'SKU') {
        rows = await this.db.queryMany(
          `SELECT c.* FROM sim_catalog c
           INNER JOIN sim_listings l ON l.asin = c.asin
           WHERE l.sku = ANY($1) ORDER BY c.asin`,
          [params.identifiers],
        );
      }
    } else if (params.keywords) {
      rows = await this.db.queryMany(
        `SELECT * FROM sim_catalog WHERE title ILIKE $1 ORDER BY asin LIMIT 20`,
        [`%${params.keywords}%`],
      );
    }

    return {
      numberOfResults: rows.length,
      items: rows.map((row) => this.formatCatalogItem(row)),
    };
  }

  async getItem(asin: string, marketplaceIds: string[]): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT * FROM sim_catalog WHERE asin = $1`,
      [asin],
    );

    if (!row) {
      throw new NotFoundException(`Catalog item not found: ${asin}`);
    }

    return this.formatCatalogItem(row);
  }

  private formatCatalogItem(row: any): any {
    return {
      asin: row.asin,
      summaries: [
        {
          marketplaceId: 'ATVPDKIKX0DER',
          brandName: row.brand,
          itemName: row.title,
          productTypes: [{ productType: row.product_type || 'PRODUCT' }],
        },
      ],
      attributes: {
        brand: [{ value: row.brand }],
        item_name: [{ value: row.title }],
        ...(row.attributes || {}),
      },
      dimensions: row.dimensions
        ? { marketplaceId: 'ATVPDKIKX0DER', ...row.dimensions }
        : undefined,
      images: Array.isArray(row.images) ? row.images : [],
      salesRanks: row.sales_rank
        ? [
            {
              marketplaceId: 'ATVPDKIKX0DER',
              classificationRanks: [{ rank: row.sales_rank, title: 'Electronics' }],
            },
          ]
        : [],
    };
  }
}
