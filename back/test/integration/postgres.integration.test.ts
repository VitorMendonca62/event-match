import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import request from 'supertest';

import { createApplication } from '../../src/main';

const databaseUrl = process.env.DATABASE_INTEGRATION_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');
}

describe('PostgreSQL foundation (integration)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_SSL_MODE = 'disable';
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  test('returns readiness 200 against PostgreSQL', async () => {
    await request(app.getHttpServer()).get('/health/readiness').expect(200);
  });

  test('keeps one pool connection and rolls back the transaction on failure', async () => {
    const database = drizzle({ client: pool });
    await pool.query('CREATE TEMPORARY TABLE drizzle_transaction_probe (id integer)');

    await expect(database.transaction(async (transaction) => {
      await transaction.execute(sql`INSERT INTO drizzle_transaction_probe (id) VALUES (1)`);
      throw new Error('rollback probe');
    })).rejects.toThrow('rollback probe');

    const result = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM drizzle_transaction_probe',
    );
    expect(result.rows[0]?.count).toBe('0');
    expect(pool.totalCount).toBe(1);
  });
});
