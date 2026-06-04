import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  async onModuleInit() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'simulator',
      password: process.env.DB_PASSWORD || 'simulator',
      database: process.env.DB_NAME || 'amazon_simulator',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      this.logger.log('Database connected successfully');
      client.release();
    } catch (err) {
      this.logger.error('Failed to connect to database', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await this.pool.query<T>(text, params);
    return result.rows[0] || null;
  }

  async queryMany<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async execute(text: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(text, params);
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
