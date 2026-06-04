import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const VALID_CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'JPY', 'AUD'];
const VALID_IMAGE_TYPES = ['MAIN', 'PT01', 'PT02', 'PT03', 'PT04', 'PT05', 'PT06', 'PT07', 'PT08', 'SWCH'];
const VALID_CASE_TYPES = [
  'LISTING_SUPPRESSION_APPEAL',
  'FBA_FEE_DISPUTE',
  'ACCOUNT_HEALTH',
  'GENERAL_INQUIRY',
];
const VALID_REIMBURSEMENT_REASONS = [
  'DIMENSION_CHANGE_FEE_OVERCHARGE',
  'FBA_DAMAGE',
  'FBA_LOST',
];

@Injectable()
export class SellerCentralValidationService {
  constructor(private readonly db: DatabaseService) {}

  async validate(type: string, payload: any, sellerId: string): Promise<ValidationResult> {
    switch (type) {
      case 'APPROVE_PRICE_CHANGE':
        return this.validatePriceChange(payload, sellerId);
      case 'UPLOAD_IMAGE':
        return this.validateImageUpload(payload, sellerId);
      case 'CREATE_SHIPMENT':
        return this.validateShipment(payload, sellerId);
      case 'OPEN_CASE':
        return this.validateCase(payload);
      case 'REIMBURSE_FBA_FEE':
        return this.validateReimbursement(payload, sellerId);
      default:
        return { valid: true, errors: [] };
    }
  }

  private async skuExists(sku: string, sellerId: string): Promise<boolean> {
    const row = await this.db.queryOne(
      `SELECT id FROM sim_listings WHERE sku = $1 AND seller_id = $2 LIMIT 1`,
      [sku, sellerId],
    );
    return !!row;
  }

  private async validatePriceChange(payload: any, sellerId: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!payload.sku) {
      errors.push({ code: 'MISSING_SKU', message: 'SKU is required', field: 'sku' });
    } else {
      const exists = await this.skuExists(payload.sku, sellerId);
      if (!exists) {
        errors.push({ code: 'SKU_NOT_FOUND', message: `SKU ${payload.sku} not found for this seller`, field: 'sku' });
      }
    }

    if (!payload.proposedPrice || payload.proposedPrice.amount === undefined) {
      errors.push({ code: 'MISSING_PRICE', message: 'proposedPrice.amount is required', field: 'proposedPrice.amount' });
    } else {
      const amount = Number(payload.proposedPrice.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({ code: 'PRICE_BELOW_MINIMUM', message: 'Price must be greater than 0', field: 'proposedPrice.amount' });
      } else if (amount < 1.00) {
        errors.push({ code: 'PRICE_BELOW_MINIMUM', message: 'Price must be at least $1.00', field: 'proposedPrice.amount' });
      } else if (amount > 9999.99) {
        errors.push({ code: 'PRICE_ABOVE_MAXIMUM', message: 'Price must not exceed $9999.99', field: 'proposedPrice.amount' });
      }
    }

    const currency = payload.currencyCode || (payload.proposedPrice && payload.proposedPrice.currency);
    if (currency && !VALID_CURRENCIES.includes(currency)) {
      errors.push({ code: 'INVALID_CURRENCY', message: `Currency ${currency} is not supported. Valid: ${VALID_CURRENCIES.join(', ')}`, field: 'currencyCode' });
    }

    return { valid: errors.length === 0, errors };
  }

  private async validateImageUpload(payload: any, sellerId: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!payload.sku) {
      errors.push({ code: 'MISSING_SKU', message: 'SKU is required', field: 'sku' });
    } else {
      const exists = await this.skuExists(payload.sku, sellerId);
      if (!exists) {
        errors.push({ code: 'SKU_NOT_FOUND', message: `SKU ${payload.sku} not found for this seller`, field: 'sku' });
      }
    }

    const imageUrl = payload.imageUrl;
    if (!imageUrl) {
      errors.push({ code: 'MISSING_IMAGE_URL', message: 'imageUrl is required', field: 'imageUrl' });
    } else {
      if (!String(imageUrl).startsWith('https://')) {
        errors.push({ code: 'NON_HTTPS_IMAGE_URL', message: 'imageUrl must start with https://', field: 'imageUrl' });
      }
      const lowerUrl = String(imageUrl).toLowerCase();
      if (!lowerUrl.endsWith('.jpg') && !lowerUrl.endsWith('.jpeg') && !lowerUrl.endsWith('.png') && !lowerUrl.endsWith('.gif')) {
        errors.push({ code: 'UNSUPPORTED_IMAGE_FORMAT', message: 'Image must be .jpg, .jpeg, .png, or .gif', field: 'imageUrl' });
      }
    }

    if (!payload.imageType) {
      errors.push({ code: 'MISSING_IMAGE_TYPE', message: 'imageType is required', field: 'imageType' });
    } else if (!VALID_IMAGE_TYPES.includes(payload.imageType)) {
      errors.push({ code: 'INVALID_IMAGE_TYPE', message: `imageType must be one of: ${VALID_IMAGE_TYPES.join(', ')}`, field: 'imageType' });
    }

    return { valid: errors.length === 0, errors };
  }

  private async validateShipment(payload: any, sellerId: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!payload.sku) {
      errors.push({ code: 'MISSING_SKU', message: 'SKU is required', field: 'sku' });
    } else {
      const exists = await this.skuExists(payload.sku, sellerId);
      if (!exists) {
        errors.push({ code: 'SKU_NOT_FOUND', message: `SKU ${payload.sku} not found`, field: 'sku' });
      }
    }

    const qty = Number(payload.quantity);
    if (!payload.quantity || !Number.isFinite(qty) || qty <= 0) {
      errors.push({ code: 'NEGATIVE_OR_ZERO_QUANTITY', message: 'quantity must be greater than 0', field: 'quantity' });
    } else if (qty > 10000) {
      errors.push({ code: 'INBOUND_LIMIT_EXCEEDED', message: 'quantity must not exceed 10000', field: 'quantity' });
    }

    return { valid: errors.length === 0, errors };
  }

  private async validateCase(payload: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!payload.subject || String(payload.subject).trim() === '') {
      errors.push({ code: 'MISSING_SUBJECT', message: 'subject is required', field: 'subject' });
    }

    if (!payload.description || String(payload.description).trim() === '') {
      errors.push({ code: 'MISSING_DESCRIPTION', message: 'description is required', field: 'description' });
    }

    if (!payload.caseType) {
      errors.push({ code: 'MISSING_CASE_TYPE', message: 'caseType is required', field: 'caseType' });
    } else if (!VALID_CASE_TYPES.includes(payload.caseType)) {
      errors.push({ code: 'INVALID_CASE_TYPE', message: `caseType must be one of: ${VALID_CASE_TYPES.join(', ')}`, field: 'caseType' });
    }

    return { valid: errors.length === 0, errors };
  }

  private async validateReimbursement(payload: any, sellerId: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!payload.sku) {
      errors.push({ code: 'MISSING_SKU', message: 'SKU is required', field: 'sku' });
    } else {
      const exists = await this.skuExists(payload.sku, sellerId);
      if (!exists) {
        errors.push({ code: 'SKU_NOT_FOUND', message: `SKU ${payload.sku} not found`, field: 'sku' });
      }
    }

    if (!payload.reason) {
      errors.push({ code: 'MISSING_REASON', message: 'reason is required', field: 'reason' });
    } else if (!VALID_REIMBURSEMENT_REASONS.includes(payload.reason)) {
      errors.push({ code: 'INVALID_REASON', message: `reason must be one of: ${VALID_REIMBURSEMENT_REASONS.join(', ')}`, field: 'reason' });
    }

    if (!payload.estimatedOvercharge || payload.estimatedOvercharge.amount === undefined) {
      errors.push({ code: 'MISSING_ESTIMATED_OVERCHARGE', message: 'estimatedOvercharge.amount is required', field: 'estimatedOvercharge.amount' });
    } else {
      const amount = Number(payload.estimatedOvercharge.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({ code: 'INVALID_OVERCHARGE_AMOUNT', message: 'estimatedOvercharge.amount must be greater than 0', field: 'estimatedOvercharge.amount' });
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
