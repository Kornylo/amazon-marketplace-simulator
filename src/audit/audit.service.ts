import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async log(params: {
    actor?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    beforeState?: any;
    afterState?: any;
    metadata?: any;
  }): Promise<void> {
    await this.db.execute(
      `INSERT INTO sim_audit_log (actor, action, resource_type, resource_id, before_state, after_state, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.actor || 'system',
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        params.beforeState ? JSON.stringify(params.beforeState) : null,
        params.afterState ? JSON.stringify(params.afterState) : null,
        JSON.stringify(params.metadata || {}),
      ],
    );
  }

  async getRecent(limit = 100): Promise<any[]> {
    return this.db.queryMany(
      `SELECT * FROM sim_audit_log ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
  }
}
