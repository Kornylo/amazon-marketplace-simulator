import { ListingsService } from '../src/listings/listings.service';
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

const mockListing = {
  id: 'uuid-1',
  seller_id: 'A1MOCKSELLER123',
  marketplace_id: 'ATVPDKIKX0DER',
  sku: 'SKU-001',
  asin: 'B0MOCK0001',
  title: 'Test Product',
  status: 'Active',
  price: 29.99,
  currency_code: 'USD',
  quantity: 100,
  issues: [],
  attributes: {},
  images: [{ link: 'https://example.com/img.jpg', imageType: 'MAIN' }],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('ListingsService', () => {
  let service: ListingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MOCK_UPDATE_INSTANT_MODE = 'true';
    service = new ListingsService(
      mockDb as unknown as DatabaseService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('getListings', () => {
    it('returns formatted listings with items and count', async () => {
      mockDb.queryMany.mockResolvedValueOnce([mockListing]);

      const result = await service.getListings('A1MOCKSELLER123', 'ATVPDKIKX0DER', 'summaries,issues');

      expect(result.items).toHaveLength(1);
      expect(result.numberOfResults).toBe(1);
      expect(result.items[0].sku).toBe('SKU-001');
      expect(result.items[0].summaries).toBeDefined();
    });

    it('returns empty items array when no listings', async () => {
      mockDb.queryMany.mockResolvedValueOnce([]);

      const result = await service.getListings('UNKNOWN', 'ATVPDKIKX0DER');
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getListing', () => {
    it('returns single listing by SKU', async () => {
      mockDb.queryOne.mockResolvedValueOnce(mockListing);

      const result = await service.getListing('A1MOCKSELLER123', 'SKU-001', 'ATVPDKIKX0DER');
      expect(result.sku).toBe('SKU-001');
    });

    it('throws NotFoundException for unknown SKU', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.getListing('A1MOCKSELLER123', 'SKU-UNKNOWN', 'ATVPDKIKX0DER'),
      ).rejects.toThrow('Listing not found');
    });
  });

  describe('patchListing', () => {
    it('returns ACCEPTED with submissionId for valid patch', async () => {
      mockDb.queryOne.mockResolvedValueOnce(mockListing);
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.queryMany.mockResolvedValue([]);
      // For applyPatches (price update)
      mockDb.execute.mockResolvedValue(undefined);

      const result = await service.patchListing('A1MOCKSELLER123', 'SKU-001', 'ATVPDKIKX0DER', {
        patches: [{ path: '/attributes/list_price', value: [{ amount: 39.99, currency: 'USD' }] }],
      });

      expect(result.status).toBe('ACCEPTED');
      expect(result.submissionId).toBeTruthy();
      expect(result.sku).toBe('SKU-001');
    });

    it('throws NotFoundException for unknown SKU', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.patchListing('A1MOCKSELLER123', 'SKU-UNKNOWN', 'ATVPDKIKX0DER', { patches: [] }),
      ).rejects.toThrow('Listing not found');
    });
  });
});
