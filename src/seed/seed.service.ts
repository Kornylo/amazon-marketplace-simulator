import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const SELLER_ID = 'A1MOCKSELLER123';
const LWA_CLIENT_ID = 'amzn1.application-oa2-client.MOCK000000000001';
const LWA_CLIENT_SECRET = 'mock-lwa-secret-0000000000000001';
const MARKETPLACE_US = 'ATVPDKIKX0DER';
const MARKETPLACE_CA = 'A2EUQ1WTGCTBG2';

const PRODUCT_TITLES = [
  'Premium Wireless Bluetooth Speaker - Waterproof Portable',
  'Stainless Steel Water Bottle 32oz - BPA Free',
  'Ergonomic Laptop Stand Adjustable - Aluminum',
  'Bamboo Cutting Board Set with Juice Groove',
  'Smart LED Desk Lamp with Wireless Charger',
  'Resistance Bands Set for Workout - 5 Levels',
  'Foam Roller for Deep Tissue Massage - 18 inch',
  'Aromatherapy Essential Oil Diffuser 500ml',
  'Portable Phone Charger 20000mAh Power Bank',
  'Yoga Mat Non-Slip 6mm Extra Thick',
  'Insulated Lunch Box Bag - Leak Proof',
  'Electric Toothbrush Head Replacement Pack',
  'Cable Management Organizer Box Large',
  'Silicone Baking Mat Set Non-Stick Reusable',
  'Microfiber Cleaning Cloths - Pack of 12',
  'Garden Kneeling Pad Cushion Waterproof',
  'Stainless Steel Meal Prep Containers Set',
  'Bluetooth Earphones True Wireless Sports',
  'Digital Kitchen Scale with LCD Display',
  'Reusable Grocery Bags Heavy Duty Foldable',
  'Adjustable Dumbbells Set 5-52.5 lbs',
  'Silicone Ice Cube Tray Large Spheres',
  'USB Hub 7-Port with Individual Switches',
  'Bamboo Toothbrush Set of 10 Biodegradable',
  'Standing Desk Converter Height Adjustable',
  'Memory Foam Pillow Cervical Ergonomic',
  'Air Purifier HEPA Filter Small Room',
  'Compostable Trash Bags 13 Gallon 50 Count',
  'Magnetic Whiteboard Markers Dry Erase',
  'Solar Panel Charger 21W Portable Foldable',
  'Non-Stick Pan Set 3-Piece Granite Coated',
  'Posture Corrector Adjustable Upper Back Brace',
  'LED Strip Lights 32.8ft Color Changing',
  'Wrist Wrap Support Weightlifting Straps',
  'Foldable Storage Bins Fabric Cube Organizer',
  'Coffee Grinder Electric Burr Grinder',
  'Reusable Beeswax Food Wraps Set of 9',
  'Floating Wall Shelves Set of 3 Rustic',
  'Car Phone Mount Dashboard Magnetic',
  'Weighted Jump Rope Speed Bearing',
  'Shower Caddy Rustproof Stainless Steel',
  'Bamboo Phone Stand Desk Organizer',
  'Collapsible Straws Reusable Metal Straw Set',
  'Picture Hanging Strips Large Heavy Duty',
  'Seed Starting Trays 72 Cell Seedling',
  'Insect Repellent Wristbands DEET-Free',
  'Laptop Cooling Pad with LED Lights',
  'Dry Erase Calendar Board Monthly Planner',
  'Natural Loofah Sponge Exfoliating Body Scrub',
  'Resistance Loop Bands Set of 5 Fabric',
];

const BRANDS = ['TechPro', 'EcoHome', 'ActiveLife', 'PureKitchen', 'SmartDesk', 'NatureWell', 'FitGear', 'OrganizeMe'];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed(): Promise<void> {
    this.logger.log('Starting seed...');

    try {
      await this.seedSeller();
      await this.seedListings();
      await this.seedOrders();
      await this.seedShipments();
      await this.seedCases();
      await this.seedReimbursements();
      await this.seedPolicies();
      await this.seedInitialScenario();
      this.logger.log('Seed complete.');
    } catch (err) {
      this.logger.error('Seed error:', err);
    }
  }

  private async seedSeller(): Promise<void> {
    const existing = await this.db.queryOne(
      `SELECT id FROM sim_sellers WHERE seller_id = $1`,
      [SELLER_ID],
    );

    if (existing) {
      this.logger.log('Seller already seeded, skipping.');
      return;
    }

    await this.db.execute(
      `INSERT INTO sim_sellers (seller_id, lwa_client_id, lwa_client_secret, marketplace_ids)
       VALUES ($1, $2, $3, $4)`,
      [SELLER_ID, LWA_CLIENT_ID, LWA_CLIENT_SECRET, [MARKETPLACE_US, MARKETPLACE_CA]],
    );

    this.logger.log(`Seeded seller: ${SELLER_ID}`);
  }

  private async seedListings(): Promise<void> {
    const existing = await this.db.queryOne(
      `SELECT id FROM sim_listings WHERE seller_id = $1 LIMIT 1`,
      [SELLER_ID],
    );

    if (existing) {
      this.logger.log('Listings already seeded, skipping.');
      return;
    }

    const listings: any[] = [];

    // 50 Active (SKU-001 to SKU-050)
    for (let i = 1; i <= 50; i++) {
      const skuNum = String(i).padStart(3, '0');
      const asinNum = String(i).padStart(4, '0');
      const title = PRODUCT_TITLES[(i - 1) % PRODUCT_TITLES.length];
      const brand = BRANDS[(i - 1) % BRANDS.length];
      const price = (19.99 + (i * 3.5)).toFixed(2);

      listings.push({
        sellerId: SELLER_ID,
        marketplaceId: MARKETPLACE_US,
        sku: `SKU-${skuNum}`,
        asin: `B0MOCK${asinNum}`,
        title,
        status: 'Active',
        price: parseFloat(price),
        currency: 'USD',
        quantity: 50 + Math.floor(Math.random() * 150),
        issues: [],
        attributes: { brand: [{ value: brand }], product_type: 'PRODUCT' },
        images: [
          {
            link: `https://images-na.ssl-images-amazon.com/images/I/mock-${asinNum}.jpg`,
            imageType: 'MAIN',
            height: 1000,
            width: 1000,
          },
        ],
      });
    }

    // 10 Suppressed (SKU-051 to SKU-060)
    for (let i = 51; i <= 60; i++) {
      const skuNum = String(i).padStart(3, '0');
      const asinNum = String(i).padStart(4, '0');
      const title = `Suppressed Product ${i - 50} - Missing Main Image`;
      const price = (24.99 + ((i - 51) * 2.5)).toFixed(2);

      listings.push({
        sellerId: SELLER_ID,
        marketplaceId: MARKETPLACE_US,
        sku: `SKU-${skuNum}`,
        asin: `B0MOCK${asinNum}`,
        title,
        status: 'Suppressed',
        price: parseFloat(price),
        currency: 'USD',
        quantity: 30,
        issues: [
          {
            code: 'MISSING_MAIN_IMAGE',
            severity: 'ERROR',
            message: 'Main product image is missing',
            attributeNames: ['main_image_url'],
            enforcements: [{ actions: [{ action: 'LISTING_SUPPRESSED' }] }],
          },
        ],
        attributes: { brand: [{ value: 'TechPro' }], product_type: 'PRODUCT' },
        images: [],
      });
    }

    // 5 Out of Stock (SKU-061 to SKU-065)
    for (let i = 61; i <= 65; i++) {
      const skuNum = String(i).padStart(3, '0');
      const asinNum = String(i).padStart(4, '0');
      const title = PRODUCT_TITLES[(i - 1) % PRODUCT_TITLES.length];
      const price = (34.99 + ((i - 61) * 5)).toFixed(2);

      listings.push({
        sellerId: SELLER_ID,
        marketplaceId: MARKETPLACE_US,
        sku: `SKU-${skuNum}`,
        asin: `B0MOCK${asinNum}`,
        title,
        status: 'Active',
        price: parseFloat(price),
        currency: 'USD',
        quantity: 0,
        issues: [],
        attributes: { brand: [{ value: 'ActiveLife' }], product_type: 'PRODUCT' },
        images: [
          {
            link: `https://images-na.ssl-images-amazon.com/images/I/mock-${asinNum}.jpg`,
            imageType: 'MAIN',
            height: 1000,
            width: 1000,
          },
        ],
      });
    }

    // 5 Buy Box Lost / Hijacker (SKU-066 to SKU-070)
    for (let i = 66; i <= 70; i++) {
      const skuNum = String(i).padStart(3, '0');
      const asinNum = String(i).padStart(4, '0');
      const title = PRODUCT_TITLES[(i - 1) % PRODUCT_TITLES.length];
      const price = (49.99 + ((i - 66) * 7)).toFixed(2);

      listings.push({
        sellerId: SELLER_ID,
        marketplaceId: MARKETPLACE_US,
        sku: `SKU-${skuNum}`,
        asin: `B0MOCK${asinNum}`,
        title,
        status: 'Active',
        price: parseFloat(price),
        currency: 'USD',
        quantity: 80,
        issues: [],
        attributes: { brand: [{ value: 'FitGear' }], product_type: 'PRODUCT' },
        images: [
          {
            link: `https://images-na.ssl-images-amazon.com/images/I/mock-${asinNum}.jpg`,
            imageType: 'MAIN',
            height: 1000,
            width: 1000,
          },
        ],
      });
    }

    // 30 more Active (SKU-071 to SKU-100)
    for (let i = 71; i <= 100; i++) {
      const skuNum = String(i).padStart(3, '0');
      const asinNum = String(i).padStart(4, '0');
      const title = PRODUCT_TITLES[(i - 1) % PRODUCT_TITLES.length];
      const brand = BRANDS[(i - 1) % BRANDS.length];
      const price = (14.99 + (i * 2.1)).toFixed(2);

      listings.push({
        sellerId: SELLER_ID,
        marketplaceId: MARKETPLACE_US,
        sku: `SKU-${skuNum}`,
        asin: `B0MOCK${asinNum}`,
        title,
        status: 'Active',
        price: parseFloat(price),
        currency: 'USD',
        quantity: 20 + Math.floor(Math.random() * 100),
        issues: [],
        attributes: { brand: [{ value: brand }], product_type: 'PRODUCT' },
        images: [
          {
            link: `https://images-na.ssl-images-amazon.com/images/I/mock-${asinNum}.jpg`,
            imageType: 'MAIN',
            height: 1000,
            width: 1000,
          },
        ],
      });
    }

    for (const listing of listings) {
      await this.db.execute(
        `INSERT INTO sim_listings (seller_id, marketplace_id, sku, asin, title, status, price, currency_code, quantity, issues, attributes, images)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (seller_id, marketplace_id, sku) DO NOTHING`,
        [
          listing.sellerId,
          listing.marketplaceId,
          listing.sku,
          listing.asin,
          listing.title,
          listing.status,
          listing.price,
          listing.currency,
          listing.quantity,
          JSON.stringify(listing.issues),
          JSON.stringify(listing.attributes),
          JSON.stringify(listing.images),
        ],
      );

      // Seed inventory
      await this.db.execute(
        `INSERT INTO sim_inventory (seller_id, marketplace_id, sku, asin, fulfillable_quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (seller_id, marketplace_id, sku) DO NOTHING`,
        [
          listing.sellerId,
          listing.marketplaceId,
          listing.sku,
          listing.asin,
          listing.sku >= 'SKU-061' && listing.sku <= 'SKU-065' ? 0 : listing.quantity,
        ],
      );

      // Seed pricing
      const listedPrice = JSON.stringify({ CurrencyCode: 'USD', Amount: listing.price });
      const competitivePrice = JSON.stringify({ CurrencyCode: 'USD', Amount: (listing.price * 0.95).toFixed(2) });
      const isHijacked = listing.sku >= 'SKU-066' && listing.sku <= 'SKU-070';
      const hijackerPrice = isHijacked
        ? JSON.stringify({ CurrencyCode: 'USD', Amount: (listing.price * 0.75).toFixed(2) })
        : null;

      await this.db.execute(
        `INSERT INTO sim_pricing (seller_id, marketplace_id, asin, sku, listed_price, competitive_price, buy_box_price, buy_box_winner, hijacker_present, hijacker_price)
         VALUES ($1, $2, $3, $4, $5, $6, $5, $7, $8, $9)
         ON CONFLICT (seller_id, marketplace_id, asin) DO NOTHING`,
        [
          listing.sellerId,
          listing.marketplaceId,
          listing.asin,
          listing.sku,
          listedPrice,
          competitivePrice,
          !isHijacked,
          isHijacked,
          hijackerPrice,
        ],
      );

      // Seed catalog
      await this.db.execute(
        `INSERT INTO sim_catalog (asin, title, brand, product_type, dimensions, images, attributes, sales_rank)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (asin) DO NOTHING`,
        [
          listing.asin,
          listing.title,
          listing.attributes.brand?.[0]?.value || 'Unknown',
          'PRODUCT',
          JSON.stringify({
            length: { value: 10, unit: 'IN' },
            width: { value: 5, unit: 'IN' },
            height: { value: 2, unit: 'IN' },
            weight: { value: 1.5, unit: 'LB' },
          }),
          JSON.stringify(listing.images),
          JSON.stringify(listing.attributes),
          Math.floor(Math.random() * 50000) + 1000,
        ],
      );
    }

    this.logger.log(`Seeded ${listings.length} listings`);
  }

  private async seedOrders(): Promise<void> {
    const existing = await this.db.queryOne(
      `SELECT id FROM sim_orders WHERE seller_id = $1 LIMIT 1`,
      [SELLER_ID],
    );

    if (existing) {
      this.logger.log('Orders already seeded, skipping.');
      return;
    }

    const statuses = ['Pending', 'Unshipped', 'Shipped', 'Delivered', 'Canceled'];
    const skus = Array.from({ length: 50 }, (_, i) => `SKU-${String(i + 1).padStart(3, '0')}`);

    for (let i = 1; i <= 500; i++) {
      const orderId = `111-${String(i).padStart(7, '0')}-${String(Math.floor(Math.random() * 9000000) + 1000000)}`;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const daysAgo = Math.floor(Math.random() * 90);
      const purchaseDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const total = (9.99 + Math.random() * 200).toFixed(2);
      const sku = skus[Math.floor(Math.random() * skus.length)];

      const listing = await this.db.queryOne(
        `SELECT asin, title, price FROM sim_listings WHERE seller_id = $1 AND sku = $2`,
        [SELLER_ID, sku],
      );

      await this.db.execute(
        `INSERT INTO sim_orders (amazon_order_id, seller_id, marketplace_id, status, purchase_date, last_updated_date, order_total, ship_service_level)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
         ON CONFLICT (amazon_order_id) DO NOTHING`,
        [
          orderId,
          SELLER_ID,
          MARKETPLACE_US,
          status,
          purchaseDate,
          JSON.stringify({ CurrencyCode: 'USD', Amount: parseFloat(total) }),
          'Standard',
        ],
      );

      if (listing) {
        const qty = Math.floor(Math.random() * 3) + 1;
        await this.db.execute(
          `INSERT INTO sim_order_items (amazon_order_id, sku, asin, title, quantity_ordered, quantity_shipped, item_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            sku,
            listing.asin,
            listing.title,
            qty,
            status === 'Shipped' || status === 'Delivered' ? qty : 0,
            JSON.stringify({ CurrencyCode: 'USD', Amount: Number(listing.price) * qty }),
          ],
        );
      }
    }

    this.logger.log('Seeded 500 orders');
  }

  private async seedShipments(): Promise<void> {
    const existing = await this.db.queryOne(
      `SELECT id FROM sim_shipments WHERE seller_id = $1 LIMIT 1`,
      [SELLER_ID],
    );

    if (existing) {
      this.logger.log('Shipments already seeded, skipping.');
      return;
    }

    const shipmentStatuses = ['CREATED', 'WORKING', 'SHIPPED', 'RECEIVING', 'CLOSED'];

    for (let i = 1; i <= 10; i++) {
      const skuNum = String(i).padStart(3, '0');
      const sku = `SKU-${skuNum}`;
      const listing = await this.db.queryOne(
        `SELECT asin FROM sim_listings WHERE seller_id = $1 AND sku = $2`,
        [SELLER_ID, sku],
      );

      await this.db.execute(
        `INSERT INTO sim_shipments (shipment_id, seller_id, marketplace_id, sku, asin, quantity, status, ship_from_address, fulfillment_center_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (shipment_id) DO NOTHING`,
        [
          `FBA-SEED${String(i).padStart(4, '0')}`,
          SELLER_ID,
          MARKETPLACE_US,
          sku,
          listing?.asin || '',
          50,
          shipmentStatuses[i % shipmentStatuses.length],
          JSON.stringify({ name: 'Mock Warehouse', addressLine1: '123 Warehouse St', city: 'Phoenix', stateOrProvinceCode: 'AZ', postalCode: '85001', countryCode: 'US' }),
          'PHX7',
        ],
      );
    }

    this.logger.log('Seeded 10 shipments');
  }

  private async seedCases(): Promise<void> {
    const existing = await this.db.queryOne(
      `SELECT id FROM sim_cases WHERE seller_id = $1 LIMIT 1`,
      [SELLER_ID],
    );

    if (existing) {
      this.logger.log('Cases already seeded, skipping.');
      return;
    }

    const caseTypes = ['LISTING_SUPPRESSION_APPEAL', 'FBA_FEE_DISPUTE', 'ACCOUNT_HEALTH', 'GENERAL_INQUIRY'];
    const caseStatuses = ['OPEN', 'PENDING_AMAZON', 'RESOLVED'];

    for (let i = 1; i <= 10; i++) {
      const caseType = caseTypes[(i - 1) % caseTypes.length];
      const status = caseStatuses[(i - 1) % caseStatuses.length];
      const skuNum = String(i).padStart(3, '0');

      await this.db.execute(
        `INSERT INTO sim_cases (case_id, seller_id, marketplace_id, case_type, sku, subject, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (case_id) DO NOTHING`,
        [
          `CASE-SEED${String(i).padStart(4, '0')}`,
          SELLER_ID,
          MARKETPLACE_US,
          caseType,
          `SKU-${skuNum}`,
          `Support Case ${i}: ${caseType.replace(/_/g, ' ')}`,
          `This is a support case for SKU-${skuNum}. Please investigate and resolve.`,
          status,
        ],
      );
    }

    this.logger.log('Seeded 10 cases');
  }

  private async seedReimbursements(): Promise<void> {
    const existing = await this.db.queryOne(
      `SELECT id FROM sim_reimbursements WHERE seller_id = $1 LIMIT 1`,
      [SELLER_ID],
    );

    if (existing) {
      this.logger.log('Reimbursements already seeded, skipping.');
      return;
    }

    const reasons = ['DIMENSION_CHANGE_FEE_OVERCHARGE', 'FBA_DAMAGE', 'FBA_LOST'];
    const reimbStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REIMBURSED'];

    for (let i = 1; i <= 5; i++) {
      const reason = reasons[(i - 1) % reasons.length];
      const status = reimbStatuses[(i - 1) % reimbStatuses.length];
      const skuNum = String(71 + i).padStart(3, '0');

      const listing = await this.db.queryOne(
        `SELECT asin FROM sim_listings WHERE seller_id = $1 AND sku = $2`,
        [SELLER_ID, `SKU-${skuNum}`],
      );

      await this.db.execute(
        `INSERT INTO sim_reimbursements (reimbursement_id, seller_id, marketplace_id, sku, asin, reason, status, expected_dimensions, current_dimensions, estimated_overcharge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (reimbursement_id) DO NOTHING`,
        [
          `REIMB-SEED${String(i).padStart(4, '0')}`,
          SELLER_ID,
          MARKETPLACE_US,
          `SKU-${skuNum}`,
          listing?.asin || '',
          reason,
          status,
          JSON.stringify({ length: { value: 10, unit: 'IN' }, width: { value: 5, unit: 'IN' }, height: { value: 2, unit: 'IN' }, weight: { value: 2.0, unit: 'LB' } }),
          JSON.stringify({ length: { value: 18, unit: 'IN' }, width: { value: 10, unit: 'IN' }, height: { value: 5, unit: 'IN' }, weight: { value: 8.5, unit: 'LB' } }),
          JSON.stringify({ CurrencyCode: 'USD', Amount: (15.5 + i * 3.2).toFixed(2) }),
        ],
      );
    }

    this.logger.log('Seeded 5 reimbursements');
  }

  private async seedPolicies(): Promise<void> {
    const actionTypes = [
      'APPROVE_PRICE_CHANGE',
      'UPLOAD_IMAGE',
      'CREATE_SHIPMENT',
      'OPEN_CASE',
      'REIMBURSE_FBA_FEE',
    ];

    for (const actionType of actionTypes) {
      await this.db.execute(
        `INSERT INTO sim_sc_policies (action_type, policy)
         VALUES ($1, 'APPROVE_ONLY_VALID')
         ON CONFLICT (action_type) DO NOTHING`,
        [actionType],
      );
    }

    this.logger.log('Seeded SC policies');
  }

  private async seedInitialScenario(): Promise<void> {
    await this.db.execute(
      `INSERT INTO sim_scenarios (seller_id, scenario_key, config)
       VALUES ($1, 'HEALTHY', '{}')
       ON CONFLICT (seller_id) DO NOTHING`,
      [SELLER_ID],
    );
  }
}
