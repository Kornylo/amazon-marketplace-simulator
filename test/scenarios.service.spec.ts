import { ScenariosService } from '../src/scenarios/scenarios.service';
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

describe('ScenariosService', () => {
  let service: ScenariosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScenariosService(
      mockDb as unknown as DatabaseService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('getScenario', () => {
    it('returns scenario from DB when found', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        seller_id: 'A1MOCKSELLER123',
        scenario_key: 'LISTING_SUPPRESSION',
        config: {},
        applied_at: new Date().toISOString(),
      });

      const result = await service.getScenario('A1MOCKSELLER123');
      expect(result.scenario_key).toBe('LISTING_SUPPRESSION');
    });

    it('returns HEALTHY default when not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getScenario('UNKNOWN_SELLER');
      expect(result.scenario_key).toBe('HEALTHY');
    });
  });

  describe('switchScenario', () => {
    it('throws BadRequestException for invalid scenario', async () => {
      await expect(
        service.switchScenario('A1MOCKSELLER123', 'INVALID_SCENARIO'),
      ).rejects.toThrow();
    });

    it('applies LISTING_SUPPRESSION scenario', async () => {
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.queryOne.mockResolvedValueOnce({
        seller_id: 'A1MOCKSELLER123',
        scenario_key: 'LISTING_SUPPRESSION',
        config: {},
        applied_at: new Date().toISOString(),
      });

      const result = await service.switchScenario('A1MOCKSELLER123', 'LISTING_SUPPRESSION');

      // Should have called execute multiple times for state changes
      expect(mockDb.execute).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SCENARIO_SWITCHED' }),
      );
    });

    it('applies HEALTHY scenario and clears issues', async () => {
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.queryOne.mockResolvedValueOnce({
        seller_id: 'A1MOCKSELLER123',
        scenario_key: 'HEALTHY',
        config: {},
        applied_at: new Date().toISOString(),
      });

      await service.switchScenario('A1MOCKSELLER123', 'HEALTHY');

      // Should call UPDATE sim_listings to clear issues
      const calls = mockDb.execute.mock.calls;
      const listingUpdateCall = calls.find(
        (call) => call[0].includes('UPDATE sim_listings') && call[0].includes("issues = '[]'"),
      );
      expect(listingUpdateCall).toBeTruthy();
    });

    it('switches through all valid scenarios without throwing', async () => {
      const validScenarios = [
        'HEALTHY',
        'LISTING_SUPPRESSION',
        'OUT_OF_STOCK',
        'PRICE_MISMATCH',
        'BUY_BOX_HIJACKER',
        'DIMENSION_CHANGE',
        'MIXED_INCIDENTS',
      ];

      for (const scenario of validScenarios) {
        jest.clearAllMocks();
        mockDb.execute.mockResolvedValue(undefined);
        mockDb.queryOne.mockResolvedValue({
          seller_id: 'A1MOCKSELLER123',
          scenario_key: scenario,
          config: {},
          applied_at: new Date().toISOString(),
        });

        await expect(
          service.switchScenario('A1MOCKSELLER123', scenario),
        ).resolves.toBeTruthy();
      }
    });
  });
});
