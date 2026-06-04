import { SellerCentralValidationService } from '../src/seller-central/seller-central-validation.service';
import { DatabaseService } from '../src/database/database.service';

const mockDb = {
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  execute: jest.fn(),
  query: jest.fn(),
  withTransaction: jest.fn(),
};

describe('SellerCentralValidationService', () => {
  let service: SellerCentralValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SellerCentralValidationService(mockDb as unknown as DatabaseService);
  });

  describe('Price validation (APPROVE_PRICE_CHANGE)', () => {
    beforeEach(() => {
      // SKU exists by default
      mockDb.queryOne.mockResolvedValue({ id: 'uuid' });
    });

    it('passes for valid price', async () => {
      const result = await service.validate('APPROVE_PRICE_CHANGE', {
        sku: 'SKU-001',
        proposedPrice: { amount: 29.99 },
        currencyCode: 'USD',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails for price below $1.00', async () => {
      const result = await service.validate('APPROVE_PRICE_CHANGE', {
        sku: 'SKU-001',
        proposedPrice: { amount: 0.50 },
        currencyCode: 'USD',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('PRICE_BELOW_MINIMUM');
    });

    it('fails for price above $9999.99', async () => {
      const result = await service.validate('APPROVE_PRICE_CHANGE', {
        sku: 'SKU-001',
        proposedPrice: { amount: 10000 },
        currencyCode: 'USD',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('PRICE_ABOVE_MAXIMUM');
    });

    it('fails for invalid currency', async () => {
      const result = await service.validate('APPROVE_PRICE_CHANGE', {
        sku: 'SKU-001',
        proposedPrice: { amount: 29.99 },
        currencyCode: 'XYZ',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_CURRENCY');
    });

    it('fails when SKU not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.validate('APPROVE_PRICE_CHANGE', {
        sku: 'SKU-MISSING',
        proposedPrice: { amount: 29.99 },
        currencyCode: 'USD',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('SKU_NOT_FOUND');
    });
  });

  describe('Image validation (UPLOAD_IMAGE)', () => {
    beforeEach(() => {
      mockDb.queryOne.mockResolvedValue({ id: 'uuid' });
    });

    it('passes for valid MAIN image', async () => {
      const result = await service.validate('UPLOAD_IMAGE', {
        sku: 'SKU-051',
        imageUrl: 'https://cdn.example.com/product.jpg',
        imageType: 'MAIN',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(true);
    });

    it('fails for non-https URL', async () => {
      const result = await service.validate('UPLOAD_IMAGE', {
        sku: 'SKU-051',
        imageUrl: 'http://cdn.example.com/product.jpg',
        imageType: 'MAIN',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NON_HTTPS_IMAGE_URL')).toBe(true);
    });

    it('fails for unsupported format', async () => {
      const result = await service.validate('UPLOAD_IMAGE', {
        sku: 'SKU-051',
        imageUrl: 'https://cdn.example.com/product.webp',
        imageType: 'MAIN',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNSUPPORTED_IMAGE_FORMAT')).toBe(true);
    });

    it('accepts .jpeg, .png, .gif extensions', async () => {
      for (const ext of ['jpeg', 'png', 'gif']) {
        jest.clearAllMocks();
        mockDb.queryOne.mockResolvedValue({ id: 'uuid' });

        const result = await service.validate('UPLOAD_IMAGE', {
          sku: 'SKU-051',
          imageUrl: `https://cdn.example.com/product.${ext}`,
          imageType: 'MAIN',
        }, 'A1MOCKSELLER123');

        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Shipment validation (CREATE_SHIPMENT)', () => {
    beforeEach(() => {
      mockDb.queryOne.mockResolvedValue({ id: 'uuid' });
    });

    it('passes for valid shipment', async () => {
      const result = await service.validate('CREATE_SHIPMENT', {
        sku: 'SKU-001',
        quantity: 500,
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(true);
    });

    it('fails for zero quantity', async () => {
      const result = await service.validate('CREATE_SHIPMENT', {
        sku: 'SKU-001',
        quantity: 0,
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('NEGATIVE_OR_ZERO_QUANTITY');
    });

    it('fails for negative quantity', async () => {
      const result = await service.validate('CREATE_SHIPMENT', {
        sku: 'SKU-001',
        quantity: -10,
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('NEGATIVE_OR_ZERO_QUANTITY');
    });

    it('fails when quantity exceeds 10000', async () => {
      const result = await service.validate('CREATE_SHIPMENT', {
        sku: 'SKU-001',
        quantity: 10001,
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INBOUND_LIMIT_EXCEEDED');
    });
  });

  describe('Case validation (OPEN_CASE)', () => {
    it('passes for valid case', async () => {
      const result = await service.validate('OPEN_CASE', {
        caseType: 'LISTING_SUPPRESSION_APPEAL',
        subject: 'My listing is suppressed',
        description: 'Please review my listing suppression issue',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(true);
    });

    it('fails for missing subject', async () => {
      const result = await service.validate('OPEN_CASE', {
        caseType: 'GENERAL_INQUIRY',
        subject: '',
        description: 'Some description',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_SUBJECT')).toBe(true);
    });

    it('fails for missing description', async () => {
      const result = await service.validate('OPEN_CASE', {
        caseType: 'GENERAL_INQUIRY',
        subject: 'My subject',
        description: '',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_DESCRIPTION')).toBe(true);
    });

    it('fails for invalid caseType', async () => {
      const result = await service.validate('OPEN_CASE', {
        caseType: 'INVALID_TYPE',
        subject: 'Subject',
        description: 'Description',
      }, 'A1MOCKSELLER123');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_CASE_TYPE');
    });
  });
});
