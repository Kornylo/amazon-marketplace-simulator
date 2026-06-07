import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';

const INSTANT_MODE = () => process.env.MOCK_UPDATE_INSTANT_MODE === 'true';
const PROCESSING_DELAY = () => Number(process.env.MOCK_UPDATE_PROCESSING_DELAY_MS) || 3000;

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async getListings(
    sellerId: string,
    marketplaceId: string,
    includedData?: string,
  ): Promise<any> {
    const rows = await this.db.queryMany(
      `SELECT l.*, c.dimensions AS catalog_dimensions
         FROM sim_listings l
         LEFT JOIN sim_catalog c ON c.asin = l.asin
        WHERE l.seller_id = $1 AND l.marketplace_id = $2
        ORDER BY l.sku`,
      [sellerId, marketplaceId],
    );

    const items = rows.map((row) => this.formatListing(row, includedData));
    return { items, numberOfResults: items.length };
  }

  async getListing(
    sellerId: string,
    sku: string,
    marketplaceId: string,
    includedData?: string,
  ): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT l.*, c.dimensions AS catalog_dimensions
         FROM sim_listings l
         LEFT JOIN sim_catalog c ON c.asin = l.asin
        WHERE l.seller_id = $1 AND l.sku = $2 AND l.marketplace_id = $3`,
      [sellerId, sku, marketplaceId],
    );

    if (!row) {
      throw new NotFoundException(`Listing not found: ${sku}`);
    }

    return this.formatListing(row, includedData);
  }

  async patchListing(
    sellerId: string,
    sku: string,
    marketplaceId: string,
    body: any,
  ): Promise<any> {
    const existing = await this.db.queryOne(
      `SELECT * FROM sim_listings WHERE seller_id = $1 AND sku = $2 AND marketplace_id = $3`,
      [sellerId, sku, marketplaceId],
    );

    if (!existing) {
      throw new NotFoundException(`Listing not found: ${sku}`);
    }

    const submissionId = `sub_${uuidv4().replace(/-/g, '')}`;
    const patches = Array.isArray(body.patches) ? body.patches : [];

    // Record mock update
    await this.db.execute(
      `INSERT INTO sim_mock_updates
         (submission_id, seller_id, marketplace_id, update_type, sku, asin, status, payload)
       VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', $7)`,
      [
        submissionId,
        sellerId,
        marketplaceId,
        'LISTING_PATCH',
        sku,
        existing.asin,
        JSON.stringify(body),
      ],
    );

    await this.db.execute(
      `INSERT INTO sim_mock_update_events (submission_id, event_type, from_status, to_status, metadata)
       VALUES ($1, 'SUBMITTED', NULL, 'SUBMITTED', $2)`,
      [submissionId, JSON.stringify({ patches: patches.length })],
    );

    if (INSTANT_MODE()) {
      await this.applyPatches(submissionId, existing, patches, sellerId, sku, marketplaceId);
    } else {
      setTimeout(
        () =>
          this.applyPatches(submissionId, existing, patches, sellerId, sku, marketplaceId).catch(
            (err) => this.logger.error('Error applying patches', err),
          ),
        PROCESSING_DELAY(),
      );
    }

    return {
      sku,
      status: 'ACCEPTED',
      submissionId,
    };
  }

  private async applyPatches(
    submissionId: string,
    existing: any,
    patches: any[],
    sellerId: string,
    sku: string,
    marketplaceId: string,
  ): Promise<void> {
    const updates: Record<string, any> = {};

    for (const patch of patches) {
      const path: string = patch.path || '';
      const value = patch.value;

      if (path === '/attributes/list_price') {
        const priceVal = Array.isArray(value) ? value[0] : value;
        if (priceVal?.amount !== undefined) {
          updates.price = Number(priceVal.amount);
          updates.currency_code = priceVal.currency || 'USD';
        }
      } else if (path === '/attributes/item_name') {
        const nameVal = Array.isArray(value) ? value[0] : value;
        if (nameVal?.value !== undefined) {
          updates.title = String(nameVal.value);
        }
      } else if (path === '/attributes/main_image_url' || path === '/attributes/images') {
        const imgVal = Array.isArray(value) ? value[0] : value;
        const imgUrl = imgVal?.value || imgVal?.link || imgVal;
        if (imgUrl) {
          const currentImages = Array.isArray(existing.images) ? existing.images : [];
          const newImage = { link: String(imgUrl), imageType: 'MAIN', height: 1000, width: 1000 };
          updates.images = JSON.stringify([newImage, ...currentImages.filter((i: any) => i.imageType !== 'MAIN')]);

          // Remove MISSING_MAIN_IMAGE from issues
          const currentIssues = Array.isArray(existing.issues) ? existing.issues : [];
          const filteredIssues = currentIssues.filter((i: any) => i.code !== 'MISSING_MAIN_IMAGE');
          updates.issues = JSON.stringify(filteredIssues);

          if (filteredIssues.length === 0 && existing.status === 'Suppressed') {
            updates.status = 'Active';
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      // Generic attribute update — mark as applied
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates)
        .map((key, i) => `${key} = $${i + 3}`)
        .join(', ');
      const values = Object.values(updates);

      await this.db.execute(
        `UPDATE sim_listings SET ${setClauses}, updated_at = NOW()
         WHERE seller_id = $1 AND sku = $2`,
        [sellerId, sku, ...values],
      );
    }

    await this.db.execute(
      `UPDATE sim_mock_updates SET status = 'APPLIED', updated_at = NOW()
       WHERE submission_id = $1`,
      [submissionId],
    );

    await this.db.execute(
      `INSERT INTO sim_mock_update_events (submission_id, event_type, from_status, to_status)
       VALUES ($1, 'APPLIED', 'SUBMITTED', 'APPLIED')`,
      [submissionId],
    );

    await this.audit.log({
      action: 'LISTING_PATCH_APPLIED',
      resourceType: 'listing',
      resourceId: sku,
      beforeState: existing,
      afterState: updates,
    });
  }

  private formatListing(row: any, includedData?: string): any {
    const include = includedData ? includedData.split(',').map((s) => s.trim()) : ['summaries', 'issues', 'attributes', 'offers', 'images'];

    const result: any = { sku: row.sku };

    if (include.includes('summaries')) {
      result.summaries = [
        {
          marketplaceId: row.marketplace_id,
          asin: row.asin,
          productType: row.attributes?.product_type || 'PRODUCT',
          status: row.status === 'Active' ? ['BUYABLE', 'DISCOVERABLE'] : row.status === 'Suppressed' ? ['SUPPRESSED_DO_NOT_SHOW'] : [row.status],
          itemName: row.title,
          createdDate: row.created_at,
          lastUpdatedDate: row.updated_at,
          mainImage: Array.isArray(row.images) && row.images.length > 0
            ? row.images.find((i: any) => i.imageType === 'MAIN') || row.images[0]
            : null,
        },
      ];
    }

    if (include.includes('issues')) {
      result.issues = Array.isArray(row.issues) ? row.issues : [];
    }

    if (include.includes('attributes')) {
      const baseAttrs = row.attributes || {};
      // Merge catalog dimensions into attributes so the backend can detect FBA fee changes.
      // sim_catalog stores { length, width, height, weight } at the top level;
      // the backend FBA service expects { dimensions: { package: { length, width, height, weight } } }.
      const catalogDims = row.catalog_dimensions as Record<string, any> | null;
      const dimensionAttrs: Record<string, any> = {};
      if (catalogDims) {
        const unitMap: Record<string, string> = { IN: 'inches', LB: 'pounds', CM: 'centimeters', KG: 'kilograms' };
        const mapUnit = (u: string) => unitMap[u?.toUpperCase()] ?? u?.toLowerCase() ?? 'inches';
        dimensionAttrs.dimensions = {
          package: {
            length: catalogDims.length ? { value: catalogDims.length.value, unit: mapUnit(catalogDims.length.unit) } : undefined,
            width:  catalogDims.width  ? { value: catalogDims.width.value,  unit: mapUnit(catalogDims.width.unit)  } : undefined,
            height: catalogDims.height ? { value: catalogDims.height.value, unit: mapUnit(catalogDims.height.unit) } : undefined,
            weight: catalogDims.weight ? { value: catalogDims.weight.value, unit: mapUnit(catalogDims.weight.unit) } : undefined,
          },
        };
      }
      result.attributes = { ...baseAttrs, ...dimensionAttrs };
    }

    if (include.includes('offers')) {
      result.offers = [
        {
          marketplaceId: row.marketplace_id,
          offerType: 'B2C',
          price: {
            currencyCode: row.currency_code || 'USD',
            amount: row.price ? Number(row.price) : 0,
          },
        },
      ];
    }

    if (include.includes('images')) {
      result.images = Array.isArray(row.images) ? row.images : [];
    }

    if (include.includes('fulfillmentAvailability')) {
      result.fulfillmentAvailability = [
        {
          fulfillmentChannelCode: 'AMAZON_NA',
          quantity: row.quantity || 0,
        },
      ];
    }

    return result;
  }
}
