import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';

const VALID_SCENARIOS = [
  'HEALTHY',
  'LISTING_SUPPRESSION',
  'OUT_OF_STOCK',
  'PRICE_MISMATCH',
  'BUY_BOX_HIJACKER',
  'DIMENSION_CHANGE',
  'MIXED_INCIDENTS',
];

@Injectable()
export class ScenariosService {
  private readonly logger = new Logger(ScenariosService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async getScenario(sellerId: string): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT * FROM sim_scenarios WHERE seller_id = $1`,
      [sellerId],
    );
    return row || { seller_id: sellerId, scenario_key: 'HEALTHY', config: {}, applied_at: null };
  }

  async switchScenario(sellerId: string, scenarioKey: string, config?: any): Promise<any> {
    if (!VALID_SCENARIOS.includes(scenarioKey)) {
      throw new BadRequestException(
        `Invalid scenario. Valid scenarios: ${VALID_SCENARIOS.join(', ')}`,
      );
    }

    this.logger.log(`Switching scenario to ${scenarioKey} for seller ${sellerId}`);

    await this.db.execute(
      `INSERT INTO sim_scenarios (seller_id, scenario_key, config, applied_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (seller_id) DO UPDATE SET scenario_key = $2, config = $3, applied_at = NOW()`,
      [sellerId, scenarioKey, JSON.stringify(config || {})],
    );

    // Apply scenario state changes
    switch (scenarioKey) {
      case 'HEALTHY':
        await this.applyHealthy(sellerId);
        break;
      case 'LISTING_SUPPRESSION':
        await this.applyListingSuppression(sellerId);
        break;
      case 'OUT_OF_STOCK':
        await this.applyOutOfStock(sellerId);
        break;
      case 'PRICE_MISMATCH':
        await this.applyPriceMismatch(sellerId);
        break;
      case 'BUY_BOX_HIJACKER':
        await this.applyBuyBoxHijacker(sellerId);
        break;
      case 'DIMENSION_CHANGE':
        await this.applyDimensionChange(sellerId);
        break;
      case 'MIXED_INCIDENTS':
        await this.applyMixedIncidents(sellerId);
        break;
    }

    await this.audit.log({
      action: 'SCENARIO_SWITCHED',
      resourceType: 'scenario',
      resourceId: sellerId,
      afterState: { scenarioKey },
    });

    return this.getScenario(sellerId);
  }

  private async applyHealthy(sellerId: string): Promise<void> {
    // All listings active, no issues
    await this.db.execute(
      `UPDATE sim_listings SET status = 'Active', issues = '[]', updated_at = NOW()
       WHERE seller_id = $1`,
      [sellerId],
    );

    // Restore inventory (50-200 per sku)
    await this.db.execute(
      `UPDATE sim_inventory
       SET fulfillable_quantity = 50 + (RANDOM() * 150)::INTEGER,
           inbound_working_quantity = 0,
           inbound_receiving_quantity = 0,
           updated_at = NOW()
       WHERE seller_id = $1`,
      [sellerId],
    );

    // All buy box winners, no hijackers
    await this.db.execute(
      `UPDATE sim_pricing
       SET buy_box_winner = true, hijacker_present = false, hijacker_price = NULL,
           updated_at = NOW()
       WHERE seller_id = $1`,
      [sellerId],
    );
  }

  private async applyListingSuppression(sellerId: string): Promise<void> {
    // First reset to healthy
    await this.applyHealthy(sellerId);

    const suppressionIssue = JSON.stringify([
      {
        code: 'MISSING_MAIN_IMAGE',
        severity: 'ERROR',
        message: 'Main product image is missing',
        attributeNames: ['main_image_url'],
        enforcements: [{ actions: [{ action: 'LISTING_SUPPRESSED' }] }],
      },
    ]);

    // SKU-051 through SKU-060
    await this.db.execute(
      `UPDATE sim_listings
       SET status = 'Suppressed', issues = $1, updated_at = NOW()
       WHERE seller_id = $2 AND sku IN (
         'SKU-051','SKU-052','SKU-053','SKU-054','SKU-055',
         'SKU-056','SKU-057','SKU-058','SKU-059','SKU-060'
       )`,
      [suppressionIssue, sellerId],
    );
  }

  private async applyOutOfStock(sellerId: string): Promise<void> {
    await this.applyHealthy(sellerId);

    // SKU-061 through SKU-065: fulfillable_quantity = 0
    await this.db.execute(
      `UPDATE sim_inventory
       SET fulfillable_quantity = 0, updated_at = NOW()
       WHERE seller_id = $1 AND sku IN (
         'SKU-061','SKU-062','SKU-063','SKU-064','SKU-065'
       )`,
      [sellerId],
    );
  }

  private async applyPriceMismatch(sellerId: string): Promise<void> {
    await this.applyHealthy(sellerId);

    // SKU-066..SKU-070: listed_price significantly higher than competitive_price (>20% gap)
    await this.db.execute(
      `UPDATE sim_pricing
       SET listed_price = '{"CurrencyCode":"USD","Amount":89.99}',
           competitive_price = '{"CurrencyCode":"USD","Amount":59.99}',
           buy_box_price = '{"CurrencyCode":"USD","Amount":59.99}',
           buy_box_winner = false,
           updated_at = NOW()
       WHERE seller_id = $1 AND sku IN (
         'SKU-066','SKU-067','SKU-068','SKU-069','SKU-070'
       )`,
      [sellerId],
    );

    await this.db.execute(
      `UPDATE sim_listings
       SET price = 89.99, updated_at = NOW()
       WHERE seller_id = $1 AND sku IN (
         'SKU-066','SKU-067','SKU-068','SKU-069','SKU-070'
       )`,
      [sellerId],
    );
  }

  private async applyBuyBoxHijacker(sellerId: string): Promise<void> {
    await this.applyHealthy(sellerId);

    // SKU-066..SKU-070: hijacker present with lower price
    await this.db.execute(
      `UPDATE sim_pricing
       SET hijacker_present = true,
           hijacker_price = '{"CurrencyCode":"USD","Amount":39.99}',
           buy_box_winner = false,
           buy_box_price = '{"CurrencyCode":"USD","Amount":39.99}',
           updated_at = NOW()
       WHERE seller_id = $1 AND sku IN (
         'SKU-066','SKU-067','SKU-068','SKU-069','SKU-070'
       )`,
      [sellerId],
    );

    await this.db.execute(
      `UPDATE sim_listings
       SET price = 49.99, updated_at = NOW()
       WHERE seller_id = $1 AND sku IN (
         'SKU-066','SKU-067','SKU-068','SKU-069','SKU-070'
       )`,
      [sellerId],
    );
  }

  private async applyDimensionChange(sellerId: string): Promise<void> {
    await this.applyHealthy(sellerId);

    // SKU-071..SKU-080: catalog dimensions oversized vs listing small
    const oversizedDimensions = JSON.stringify({
      length: { value: 18, unit: 'IN' },
      width: { value: 10, unit: 'IN' },
      height: { value: 5, unit: 'IN' },
      weight: { value: 8.5, unit: 'LB' },
    });

    const listingDimensions = JSON.stringify({
      length: { value: 10, unit: 'IN' },
      width: { value: 5, unit: 'IN' },
      height: { value: 2, unit: 'IN' },
      weight: { value: 2.0, unit: 'LB' },
    });

    // Update catalog to show oversized
    const skus = ['SKU-071', 'SKU-072', 'SKU-073', 'SKU-074', 'SKU-075', 'SKU-076', 'SKU-077', 'SKU-078', 'SKU-079', 'SKU-080'];

    for (const sku of skus) {
      const listing = await this.db.queryOne(
        `SELECT asin FROM sim_listings WHERE seller_id = $1 AND sku = $2`,
        [sellerId, sku],
      );
      if (listing?.asin) {
        await this.db.execute(
          `UPDATE sim_catalog SET dimensions = $1, updated_at = NOW() WHERE asin = $2`,
          [oversizedDimensions, listing.asin],
        );
      }
    }

    // Update listings to show smaller dimensions in attributes
    await this.db.execute(
      `UPDATE sim_listings
       SET attributes = jsonb_set(COALESCE(attributes, '{}'), '{dimensions}', $1::jsonb),
           updated_at = NOW()
       WHERE seller_id = $2 AND sku IN (
         'SKU-071','SKU-072','SKU-073','SKU-074','SKU-075',
         'SKU-076','SKU-077','SKU-078','SKU-079','SKU-080'
       )`,
      [listingDimensions, sellerId],
    );
  }

  private async applyMixedIncidents(sellerId: string): Promise<void> {
    await this.applyListingSuppression(sellerId);
    await this.applyOutOfStock(sellerId);
    await this.applyBuyBoxHijacker(sellerId);
  }
}
