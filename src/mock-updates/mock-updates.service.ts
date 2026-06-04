import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MockUpdatesService {
  constructor(private readonly db: DatabaseService) {}

  async getUpdates(params: {
    sellerId?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = `SELECT * FROM sim_mock_updates WHERE 1=1`;
    const values: any[] = [];

    if (params.sellerId) {
      query += ` AND seller_id = $${values.length + 1}`;
      values.push(params.sellerId);
    }

    if (params.status) {
      query += ` AND status = $${values.length + 1}`;
      values.push(params.status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(params.limit || 100);

    return this.db.queryMany(query, values);
  }

  async getUpdate(submissionId: string): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT * FROM sim_mock_updates WHERE submission_id = $1`,
      [submissionId],
    );

    if (!row) {
      throw new NotFoundException(`Submission not found: ${submissionId}`);
    }

    return row;
  }

  async getUpdateEvents(submissionId: string): Promise<any[]> {
    return this.db.queryMany(
      `SELECT * FROM sim_mock_update_events WHERE submission_id = $1 ORDER BY created_at ASC`,
      [submissionId],
    );
  }
}
