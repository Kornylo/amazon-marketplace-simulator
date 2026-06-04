import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SellerCentralValidationService } from './seller-central-validation.service';
import { v4 as uuidv4 } from 'uuid';

const INSTANT_MODE = () => process.env.MOCK_UPDATE_INSTANT_MODE === 'true';
const SC_REVIEW_DELAY = () => Number(process.env.MOCK_SELLER_CENTRAL_REVIEW_DELAY_MS) || 3000;

@Injectable()
export class SellerCentralService {
  private readonly logger = new Logger(SellerCentralService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly validation: SellerCentralValidationService,
  ) {}

  async createAction(body: any): Promise<any> {
    const { type, sellerId, marketplaceId, sku, asin, ...rest } = body;

    if (!type || !sellerId || !marketplaceId) {
      throw new BadRequestException('type, sellerId, and marketplaceId are required');
    }

    const actionId = `ACT-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    const payload = { sku, asin, ...rest };

    // Validate
    const validation = await this.validation.validate(type, payload, sellerId);

    // Get policy
    const policyRow = await this.db.queryOne(
      `SELECT policy FROM sim_sc_policies WHERE action_type = $1`,
      [type],
    );
    const policy = policyRow?.policy || 'APPROVE_ONLY_VALID';

    // Determine initial status
    let status: string;
    let decisionReason: string | null = null;

    if (policy === 'REQUIRE_MANUAL_APPROVAL') {
      status = 'SUBMITTED';
    } else if (policy === 'APPROVE_ONLY_VALID') {
      status = validation.valid ? 'APPROVED' : 'REJECTED';
      if (!validation.valid) {
        decisionReason = validation.errors.map((e) => e.message).join('; ');
      }
    } else if (policy === 'AUTO_APPROVE') {
      status = 'APPROVED';
    } else {
      status = validation.valid ? 'APPROVED' : 'REJECTED';
    }

    const now = new Date().toISOString();

    await this.db.execute(
      `INSERT INTO sim_sc_actions
         (action_id, type, seller_id, marketplace_id, sku, asin, status, payload, validation_errors, decision_reason, submitted_at, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        actionId,
        type,
        sellerId,
        marketplaceId,
        sku || null,
        asin || null,
        status,
        JSON.stringify(payload),
        JSON.stringify(validation.errors),
        decisionReason,
        now,
        status !== 'SUBMITTED' ? now : null,
      ],
    );

    await this.db.execute(
      `INSERT INTO sim_sc_action_events (action_id, event_type, from_status, to_status, actor, notes)
       VALUES ($1, 'SUBMITTED', NULL, 'SUBMITTED', 'system', $2)`,
      [actionId, `Action created via API`],
    );

    if (status !== 'SUBMITTED') {
      await this.db.execute(
        `INSERT INTO sim_sc_action_events (action_id, event_type, from_status, to_status, actor, notes)
         VALUES ($1, $2, 'SUBMITTED', $3, 'system', $4)`,
        [
          actionId,
          status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          status,
          status === 'APPROVED' ? 'Auto-approved by policy' : `Rejected: ${decisionReason}`,
        ],
      );
    }

    if (status === 'APPROVED') {
      if (INSTANT_MODE()) {
        await this.applyAction(actionId, type, sellerId, marketplaceId, payload).catch(
          (err) => this.logger.error(`Error applying action ${actionId}`, err),
        );
      } else {
        setTimeout(
          () =>
            this.applyAction(actionId, type, sellerId, marketplaceId, payload).catch(
              (err) => this.logger.error(`Error applying action ${actionId}`, err),
            ),
          SC_REVIEW_DELAY(),
        );
      }
    }

    return this.getAction(actionId);
  }

  async getActions(params: {
    type?: string;
    status?: string;
    sellerId?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = `SELECT * FROM sim_sc_actions WHERE 1=1`;
    const values: any[] = [];

    if (params.sellerId) {
      query += ` AND seller_id = $${values.length + 1}`;
      values.push(params.sellerId);
    }

    if (params.type) {
      query += ` AND type = $${values.length + 1}`;
      values.push(params.type);
    }

    if (params.status) {
      query += ` AND status = $${values.length + 1}`;
      values.push(params.status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(params.limit || 100);

    return this.db.queryMany(query, values);
  }

  async getAction(actionId: string): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT * FROM sim_sc_actions WHERE action_id = $1`,
      [actionId],
    );

    if (!row) {
      throw new NotFoundException(`Action not found: ${actionId}`);
    }

    return row;
  }

  async getActionEvents(actionId: string): Promise<any[]> {
    return this.db.queryMany(
      `SELECT * FROM sim_sc_action_events WHERE action_id = $1 ORDER BY created_at ASC`,
      [actionId],
    );
  }

  async approveAction(actionId: string, reason?: string): Promise<any> {
    const action = await this.getAction(actionId);

    if (action.status !== 'SUBMITTED') {
      throw new BadRequestException(`Action is in ${action.status} status, cannot approve`);
    }

    const now = new Date().toISOString();

    await this.db.execute(
      `UPDATE sim_sc_actions SET status = 'APPROVED', reviewed_at = $1, updated_at = $1
       WHERE action_id = $2`,
      [now, actionId],
    );

    await this.db.execute(
      `INSERT INTO sim_sc_action_events (action_id, event_type, from_status, to_status, actor, notes)
       VALUES ($1, 'APPROVED', 'SUBMITTED', 'APPROVED', 'engineer', $2)`,
      [actionId, reason || 'Manually approved'],
    );

    if (INSTANT_MODE()) {
      await this.applyAction(actionId, action.type, action.seller_id, action.marketplace_id, action.payload).catch(
        (err) => this.logger.error(`Error applying action ${actionId}`, err),
      );
    } else {
      setTimeout(
        () =>
          this.applyAction(actionId, action.type, action.seller_id, action.marketplace_id, action.payload).catch(
            (err) => this.logger.error(`Error applying action ${actionId}`, err),
          ),
        SC_REVIEW_DELAY(),
      );
    }

    return this.getAction(actionId);
  }

  async rejectAction(actionId: string, reason: string): Promise<any> {
    const action = await this.getAction(actionId);

    if (action.status !== 'SUBMITTED') {
      throw new BadRequestException(`Action is in ${action.status} status, cannot reject`);
    }

    const now = new Date().toISOString();

    await this.db.execute(
      `UPDATE sim_sc_actions SET status = 'REJECTED', reviewed_at = $1, decision_reason = $2, updated_at = $1
       WHERE action_id = $3`,
      [now, reason, actionId],
    );

    await this.db.execute(
      `INSERT INTO sim_sc_action_events (action_id, event_type, from_status, to_status, actor, notes)
       VALUES ($1, 'REJECTED', 'SUBMITTED', 'REJECTED', 'engineer', $2)`,
      [actionId, reason],
    );

    return this.getAction(actionId);
  }

  async getPolicies(): Promise<any[]> {
    return this.db.queryMany(`SELECT * FROM sim_sc_policies ORDER BY action_type`);
  }

  async upsertPolicy(actionType: string, policy: string): Promise<any> {
    await this.db.execute(
      `INSERT INTO sim_sc_policies (action_type, policy)
       VALUES ($1, $2)
       ON CONFLICT (action_type) DO UPDATE SET policy = $2, updated_at = NOW()`,
      [actionType, policy],
    );
    return this.db.queryOne(
      `SELECT * FROM sim_sc_policies WHERE action_type = $1`,
      [actionType],
    );
  }

  private async applyAction(
    actionId: string,
    type: string,
    sellerId: string,
    marketplaceId: string,
    payload: any,
  ): Promise<void> {
    const now = new Date().toISOString();

    try {
      switch (type) {
        case 'APPROVE_PRICE_CHANGE':
          await this.applyPriceChange(sellerId, marketplaceId, payload);
          break;
        case 'UPLOAD_IMAGE':
          await this.applyImageUpload(sellerId, marketplaceId, payload);
          break;
        case 'CREATE_SHIPMENT':
          await this.applyCreateShipment(sellerId, marketplaceId, payload);
          break;
        case 'OPEN_CASE':
          await this.applyOpenCase(sellerId, marketplaceId, payload);
          break;
        case 'REIMBURSE_FBA_FEE':
          await this.applyReimbursement(sellerId, marketplaceId, payload);
          break;
        default:
          this.logger.warn(`No apply handler for action type: ${type}`);
      }

      await this.db.execute(
        `UPDATE sim_sc_actions SET status = 'APPLIED', applied_at = $1, updated_at = $1
         WHERE action_id = $2`,
        [now, actionId],
      );

      await this.db.execute(
        `INSERT INTO sim_sc_action_events (action_id, event_type, from_status, to_status, actor)
         VALUES ($1, 'APPLIED', 'APPROVED', 'APPLIED', 'system')`,
        [actionId],
      );

      await this.audit.log({
        action: `SC_ACTION_${type}_APPLIED`,
        resourceType: 'sc_action',
        resourceId: actionId,
        metadata: { sellerId, marketplaceId, payload },
      });
    } catch (err) {
      this.logger.error(`Failed to apply action ${actionId}: ${err.message}`);
    }
  }

  private async applyPriceChange(sellerId: string, marketplaceId: string, payload: any): Promise<void> {
    const amount = Number(payload.proposedPrice?.amount);
    const currency = payload.currencyCode || payload.proposedPrice?.currency || 'USD';

    await this.db.execute(
      `UPDATE sim_listings SET price = $1, currency_code = $2, updated_at = NOW()
       WHERE seller_id = $3 AND sku = $4`,
      [amount, currency, sellerId, payload.sku],
    );

    // Update pricing table
    const priceJson = JSON.stringify({ CurrencyCode: currency, Amount: amount });
    await this.db.execute(
      `UPDATE sim_pricing
       SET listed_price = $1,
           buy_box_price = CASE WHEN buy_box_winner THEN $1 ELSE buy_box_price END,
           updated_at = NOW()
       WHERE seller_id = $2 AND sku = $3`,
      [priceJson, sellerId, payload.sku],
    );
  }

  private async applyImageUpload(sellerId: string, marketplaceId: string, payload: any): Promise<void> {
    const listing = await this.db.queryOne(
      `SELECT * FROM sim_listings WHERE seller_id = $1 AND sku = $2`,
      [sellerId, payload.sku],
    );

    if (!listing) return;

    const currentImages = Array.isArray(listing.images) ? listing.images : [];
    const newImage = {
      link: payload.imageUrl,
      imageType: payload.imageType,
      height: 1000,
      width: 1000,
    };

    const updatedImages = [
      newImage,
      ...currentImages.filter((i: any) => i.imageType !== payload.imageType),
    ];

    let updatedIssues = Array.isArray(listing.issues) ? listing.issues : [];
    let newStatus = listing.status;

    if (payload.imageType === 'MAIN') {
      updatedIssues = updatedIssues.filter((i: any) => i.code !== 'MISSING_MAIN_IMAGE');
      if (updatedIssues.length === 0 && listing.status === 'Suppressed') {
        newStatus = 'Active';
      }
    }

    await this.db.execute(
      `UPDATE sim_listings
       SET images = $1, issues = $2, status = $3, updated_at = NOW()
       WHERE seller_id = $4 AND sku = $5`,
      [JSON.stringify(updatedImages), JSON.stringify(updatedIssues), newStatus, sellerId, payload.sku],
    );

    // Update catalog
    if (listing.asin) {
      await this.db.execute(
        `UPDATE sim_catalog SET images = $1, updated_at = NOW() WHERE asin = $2`,
        [JSON.stringify(updatedImages), listing.asin],
      );
    }
  }

  private async applyCreateShipment(sellerId: string, marketplaceId: string, payload: any): Promise<void> {
    const shipmentId = `FBA-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const listing = await this.db.queryOne(
      `SELECT asin FROM sim_listings WHERE seller_id = $1 AND sku = $2 LIMIT 1`,
      [sellerId, payload.sku],
    );

    const asin = listing?.asin || '';

    await this.db.execute(
      `INSERT INTO sim_shipments (shipment_id, seller_id, marketplace_id, sku, asin, quantity, status, ship_from_address, fulfillment_center_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'CREATED', $7, $8)`,
      [
        shipmentId,
        sellerId,
        marketplaceId,
        payload.sku,
        asin,
        Number(payload.quantity),
        JSON.stringify(payload.shipFromAddress || {}),
        payload.fulfillmentCenterId || 'PHX7',
      ],
    );

    // Update inventory inbound
    await this.db.execute(
      `UPDATE sim_inventory
       SET inbound_working_quantity = inbound_working_quantity + $1, updated_at = NOW()
       WHERE seller_id = $2 AND sku = $3`,
      [Number(payload.quantity), sellerId, payload.sku],
    );

    // Simulate shipment progression
    const delay = INSTANT_MODE() ? 100 : SC_REVIEW_DELAY();
    const statuses = ['WORKING', 'SHIPPED', 'RECEIVING', 'CLOSED'];

    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      const statusDelay = delay * (i + 1);

      setTimeout(async () => {
        try {
          await this.db.execute(
            `UPDATE sim_shipments SET status = $1, updated_at = NOW() WHERE shipment_id = $2`,
            [status, shipmentId],
          );

          if (status === 'RECEIVING') {
            await this.db.execute(
              `UPDATE sim_inventory
               SET inbound_working_quantity = GREATEST(0, inbound_working_quantity - $1),
                   inbound_receiving_quantity = inbound_receiving_quantity + $1,
                   updated_at = NOW()
               WHERE seller_id = $2 AND sku = $3`,
              [Number(payload.quantity), sellerId, payload.sku],
            );
          }

          if (status === 'CLOSED') {
            await this.db.execute(
              `UPDATE sim_inventory
               SET inbound_receiving_quantity = GREATEST(0, inbound_receiving_quantity - $1),
                   fulfillable_quantity = fulfillable_quantity + $1,
                   updated_at = NOW()
               WHERE seller_id = $2 AND sku = $3`,
              [Number(payload.quantity), sellerId, payload.sku],
            );
          }
        } catch (err) {
          this.logger.error(`Shipment progression error: ${err.message}`);
        }
      }, statusDelay);
    }
  }

  private async applyOpenCase(sellerId: string, marketplaceId: string, payload: any): Promise<void> {
    const caseId = `CASE-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    await this.db.execute(
      `INSERT INTO sim_cases (case_id, seller_id, marketplace_id, case_type, sku, asin, subject, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')`,
      [
        caseId,
        sellerId,
        marketplaceId,
        payload.caseType,
        payload.sku || null,
        payload.asin || null,
        payload.subject,
        payload.description,
      ],
    );
  }

  private async applyReimbursement(sellerId: string, marketplaceId: string, payload: any): Promise<void> {
    const reimbursementId = `REIMB-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const listing = await this.db.queryOne(
      `SELECT asin FROM sim_listings WHERE seller_id = $1 AND sku = $2 LIMIT 1`,
      [sellerId, payload.sku],
    );

    const asin = listing?.asin || payload.asin || '';

    await this.db.execute(
      `INSERT INTO sim_reimbursements
         (reimbursement_id, seller_id, marketplace_id, sku, asin, reason, status, expected_dimensions, current_dimensions, estimated_overcharge)
       VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', $7, $8, $9)`,
      [
        reimbursementId,
        sellerId,
        marketplaceId,
        payload.sku,
        asin,
        payload.reason,
        JSON.stringify(payload.expectedDimensions || null),
        JSON.stringify(payload.currentDimensions || null),
        JSON.stringify(payload.estimatedOvercharge || null),
      ],
    );

    // Simulate reimbursement status progression
    const delay = INSTANT_MODE() ? 200 : SC_REVIEW_DELAY() * 2;
    const statuses = ['UNDER_REVIEW', 'APPROVED', 'REIMBURSED'];

    for (let i = 0; i < statuses.length; i++) {
      setTimeout(async () => {
        try {
          await this.db.execute(
            `UPDATE sim_reimbursements SET status = $1, updated_at = NOW()
             WHERE reimbursement_id = $2`,
            [statuses[i], reimbursementId],
          );
        } catch (err) {
          this.logger.error(`Reimbursement progression error: ${err.message}`);
        }
      }, delay * (i + 1));
    }
  }
}
