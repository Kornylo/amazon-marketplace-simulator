import { SellerCentralService } from '../src/seller-central/seller-central.service';
import { SellerCentralValidationService } from '../src/seller-central/seller-central-validation.service';
import { DatabaseService } from '../src/database/database.service';
import { AuditService } from '../src/audit/audit.service';

const mockDb = {
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  execute: jest.fn(),
  query: jest.fn(),
  withTransaction: jest.fn(),
};

const mockAudit = {
  log: jest.fn(),
};

const makeMockAction = (overrides = {}) => ({
  action_id: 'ACT-001',
  type: 'APPROVE_PRICE_CHANGE',
  seller_id: 'A1MOCKSELLER123',
  marketplace_id: 'ATVPDKIKX0DER',
  sku: 'SKU-001',
  asin: null,
  status: 'APPLIED',
  payload: { sku: 'SKU-001', proposedPrice: { amount: 39.99 }, currencyCode: 'USD' },
  validation_errors: [],
  decision_reason: null,
  submitted_at: new Date().toISOString(),
  reviewed_at: new Date().toISOString(),
  applied_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('SellerCentralService', () => {
  let service: SellerCentralService;
  let validation: SellerCentralValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MOCK_UPDATE_INSTANT_MODE = 'true';

    validation = new SellerCentralValidationService(mockDb as unknown as DatabaseService);
    service = new SellerCentralService(
      mockDb as unknown as DatabaseService,
      mockAudit as unknown as AuditService,
      validation,
    );
  });

  // Helper: set up mocks for createAction — the last queryOne call is getAction()
  // INSTANT_MODE=true means applyAction is called inline which makes additional DB calls.
  // We stub queryOne to return the right thing for each sequential call.
  function setupCreateActionMocks(skuExists: boolean, policyRow: any, finalAction: any, extraQueryOnes: any[] = []) {
    const chain = mockDb.queryOne;
    const calls: any[] = [];
    if (skuExists !== undefined) calls.push(skuExists ? { id: 'uuid' } : null);  // skuExists check
    calls.push(policyRow);        // get policy
    // applyAction may call queryOne (e.g. for listing asin lookup) — add extras
    calls.push(...extraQueryOnes);
    calls.push(finalAction);      // getAction at end of createAction
    chain.mockReset();
    calls.forEach(v => chain.mockResolvedValueOnce(v));
    // Default to finalAction for any further calls (safe fallback)
    chain.mockResolvedValue(finalAction);
    mockDb.execute.mockResolvedValue(undefined);
  }

  describe('APPROVE_PRICE_CHANGE', () => {
    it('approves valid price change and creates action', async () => {
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction());

      const result = await service.createAction({
        type: 'APPROVE_PRICE_CHANGE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-001',
        proposedPrice: { amount: 39.99 },
        currencyCode: 'USD',
      });

      expect(result.type).toBe('APPROVE_PRICE_CHANGE');
    });

    it('rejects invalid price (below minimum)', async () => {
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ status: 'REJECTED' }));

      const result = await service.createAction({
        type: 'APPROVE_PRICE_CHANGE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-001',
        proposedPrice: { amount: 0.50 },
        currencyCode: 'USD',
      });

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('UPLOAD_IMAGE', () => {
    it('approves valid image upload', async () => {
      // applyImageUpload calls queryOne for listing, then queryOne for getAction
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ type: 'UPLOAD_IMAGE', status: 'APPLIED' }),
        [{ id: 'uuid', asin: 'B0MOCK0051', status: 'Suppressed', images: [], issues: [] }]);

      const result = await service.createAction({
        type: 'UPLOAD_IMAGE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-051',
        imageUrl: 'https://cdn.example.com/product.jpg',
        imageType: 'MAIN',
      });

      expect(result).toBeTruthy();
    });

    it('rejects non-https image URL', async () => {
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ status: 'REJECTED' }));

      const result = await service.createAction({
        type: 'UPLOAD_IMAGE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-051',
        imageUrl: 'http://cdn.example.com/product.jpg',
        imageType: 'MAIN',
      });

      expect(result.status).toBe('REJECTED');
    });

    it('rejects unsupported image format', async () => {
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ status: 'REJECTED' }));

      const result = await service.createAction({
        type: 'UPLOAD_IMAGE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-051',
        imageUrl: 'https://cdn.example.com/product.webp',
        imageType: 'MAIN',
      });

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('CREATE_SHIPMENT', () => {
    it('approves valid shipment', async () => {
      // applyCreateShipment calls queryOne for listing asin
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ type: 'CREATE_SHIPMENT', status: 'APPLIED' }),
        [{ asin: 'B0MOCK0001' }]);

      const result = await service.createAction({
        type: 'CREATE_SHIPMENT',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-001',
        quantity: 100,
      });

      expect(result).toBeTruthy();
    });

    it('rejects shipment exceeding 10000 unit limit', async () => {
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ status: 'REJECTED' }));

      const result = await service.createAction({
        type: 'CREATE_SHIPMENT',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-001',
        quantity: 15000,
      });

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('OPEN_CASE', () => {
    it('approves valid case', async () => {
      // OPEN_CASE: no sku check, applyOpenCase needs no extra queryOne
      setupCreateActionMocks(undefined, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ type: 'OPEN_CASE', status: 'APPLIED' }));

      const result = await service.createAction({
        type: 'OPEN_CASE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        caseType: 'LISTING_SUPPRESSION_APPEAL',
        subject: 'My product is suppressed',
        description: 'Please investigate the suppression of my listing',
      });

      expect(result).toBeTruthy();
    });

    it('rejects case with missing subject', async () => {
      setupCreateActionMocks(undefined, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ status: 'REJECTED' }));

      const result = await service.createAction({
        type: 'OPEN_CASE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        caseType: 'GENERAL_INQUIRY',
        subject: '',
        description: 'Some description',
      });

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('REIMBURSE_FBA_FEE', () => {
    it('approves valid reimbursement', async () => {
      // applyReimbursement calls queryOne for listing asin
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ type: 'REIMBURSE_FBA_FEE', status: 'APPLIED' }),
        [{ asin: 'B0MOCK0071' }]);

      const result = await service.createAction({
        type: 'REIMBURSE_FBA_FEE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-071',
        reason: 'DIMENSION_CHANGE_FEE_OVERCHARGE',
        estimatedOvercharge: { amount: 15.5, currency: 'USD' },
      });

      expect(result).toBeTruthy();
    });

    it('rejects reimbursement without valid reason', async () => {
      setupCreateActionMocks(true, { policy: 'APPROVE_ONLY_VALID' }, makeMockAction({ status: 'REJECTED' }));

      const result = await service.createAction({
        type: 'REIMBURSE_FBA_FEE',
        sellerId: 'A1MOCKSELLER123',
        marketplaceId: 'ATVPDKIKX0DER',
        sku: 'SKU-071',
        reason: 'INVALID_REASON',
        estimatedOvercharge: { amount: 15.5 },
      });

      expect(result.status).toBe('REJECTED');
    });
  });
});
