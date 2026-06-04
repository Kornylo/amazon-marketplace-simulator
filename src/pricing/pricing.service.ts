import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PricingService {
  constructor(private readonly db: DatabaseService) {}

  async getPriceByAsins(marketplaceId: string, asins: string[]): Promise<any> {
    const rows = await this.db.queryMany(
      `SELECT p.*, l.sku FROM sim_pricing p
       LEFT JOIN sim_listings l ON l.asin = p.asin AND l.marketplace_id = p.marketplace_id
       WHERE p.marketplace_id = $1 AND p.asin = ANY($2)`,
      [marketplaceId, asins],
    );

    const responses = rows.map((row) => ({
      status: { statusCode: 200 },
      body: {
        ASIN: row.asin,
        sellerSKU: row.sku,
        Product: {
          Offers: [
            {
              BuyingPrice: {
                ListingPrice: row.listed_price || { CurrencyCode: 'USD', Amount: 0 },
                LandedPrice: row.listed_price || { CurrencyCode: 'USD', Amount: 0 },
              },
              RegularPrice: row.listed_price || { CurrencyCode: 'USD', Amount: 0 },
              IsBuyBoxWinner: row.buy_box_winner,
            },
          ],
        },
      },
    }));

    return { responses };
  }

  async getCompetitivePriceByAsins(marketplaceId: string, asins: string[]): Promise<any> {
    const rows = await this.db.queryMany(
      `SELECT * FROM sim_pricing
       WHERE marketplace_id = $1 AND asin = ANY($2)`,
      [marketplaceId, asins],
    );

    const responses = rows.map((row) => ({
      status: { statusCode: 200 },
      body: {
        ASIN: row.asin,
        Product: {
          CompetitivePricing: {
            CompetitivePrices: [
              {
                condition: 'New',
                price: {
                  ListingPrice: row.competitive_price || row.listed_price || { CurrencyCode: 'USD', Amount: 0 },
                  LandedPrice: row.competitive_price || row.listed_price || { CurrencyCode: 'USD', Amount: 0 },
                },
                belongsToRequester: row.buy_box_winner,
              },
              ...(row.hijacker_present
                ? [
                    {
                      condition: 'New',
                      price: {
                        ListingPrice: row.hijacker_price || { CurrencyCode: 'USD', Amount: 0 },
                        LandedPrice: row.hijacker_price || { CurrencyCode: 'USD', Amount: 0 },
                      },
                      belongsToRequester: false,
                    },
                  ]
                : []),
            ],
            NumberOfOfferListings: row.hijacker_present ? 2 : 1,
          },
        },
      },
    }));

    return { responses };
  }
}
