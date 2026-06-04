import { AuthService } from '../src/auth/auth.service';
import { DatabaseService } from '../src/database/database.service';

const mockDb = {
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  execute: jest.fn(),
  query: jest.fn(),
  withTransaction: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(mockDb as unknown as DatabaseService);
  });

  describe('issueToken', () => {
    it('returns token for valid credentials', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        seller_id: 'A1MOCKSELLER123',
        lwa_client_id: 'client-id',
        lwa_client_secret: 'secret',
      });
      mockDb.execute.mockResolvedValueOnce(undefined);

      const result = await service.issueToken({
        grantType: 'refresh_token',
        clientId: 'client-id',
        clientSecret: 'secret',
      });

      expect(result.access_token).toBeTruthy();
      expect(result.token_type).toBe('bearer');
      expect(result.expires_in).toBe(3600);
    });

    it('throws 401 for invalid credentials', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.issueToken({
          grantType: 'refresh_token',
          clientId: 'bad-id',
          clientSecret: 'bad-secret',
        }),
      ).rejects.toThrow('Invalid client_id or client_secret');
    });

    it('throws 401 for unsupported grant_type', async () => {
      await expect(
        service.issueToken({
          grantType: 'authorization_code',
          clientId: 'id',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Unsupported grant_type');
    });
  });

  describe('validateToken', () => {
    it('returns sellerId for valid non-expired token', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ seller_id: 'A1MOCKSELLER123' });

      const result = await service.validateToken('valid-token');
      expect(result).toBe('A1MOCKSELLER123');
    });

    it('returns null for expired or unknown token', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.validateToken('bad-token');
      expect(result).toBeNull();
    });
  });
});
