import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly db: DatabaseService) {}

  async issueToken(params: {
    grantType: string;
    refreshToken?: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{ access_token: string; token_type: string; expires_in: number }> {
    if (params.grantType !== 'refresh_token') {
      throw new UnauthorizedException('Unsupported grant_type');
    }

    // Find seller by client credentials
    const seller = await this.db.queryOne(
      `SELECT * FROM sim_sellers WHERE lwa_client_id = $1 AND lwa_client_secret = $2`,
      [params.clientId, params.clientSecret],
    );

    if (!seller) {
      throw new UnauthorizedException('Invalid client_id or client_secret');
    }

    // Generate access token
    const token = `Atza|${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    await this.db.execute(
      `INSERT INTO sim_access_tokens (seller_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [seller.seller_id, token, expiresAt.toISOString()],
    );

    this.logger.log(`Issued token for seller ${seller.seller_id}`);

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
    };
  }

  async validateToken(token: string): Promise<string | null> {
    const record = await this.db.queryOne(
      `SELECT seller_id FROM sim_access_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token],
    );

    return record ? record.seller_id : null;
  }

  async revokeExpiredTokens(): Promise<void> {
    await this.db.execute(
      `DELETE FROM sim_access_tokens WHERE expires_at <= NOW()`,
    );
  }
}
