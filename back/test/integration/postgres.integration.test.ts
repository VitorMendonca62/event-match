import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';

import { createApplication } from '../../src/main';
import type { UnitOfWorkPort } from '../../src/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK_PORT } from '../../src/shared/application/ports/unit-of-work.port';
import type {
  DrizzleDatabase,
  PostgresPool,
} from '../../src/shared/infrastructure/persistence/database.types';
import { DRIZZLE_DB, PG_POOL } from '../../src/shared/infrastructure/persistence/tokens';

const databaseUrl = process.env.DATABASE_INTEGRATION_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');
}

describe('PostgreSQL foundation (integration)', () => {
  let app: INestApplication;
  let pool: PostgresPool;
  let database: DrizzleDatabase;
  let unitOfWork: UnitOfWorkPort;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_SSL_MODE = 'disable';
    app = await createApplication();
    await app.init();
    pool = app.get<PostgresPool>(PG_POOL);
    database = app.get<DrizzleDatabase>(DRIZZLE_DB);
    unitOfWork = app.get<UnitOfWorkPort>(UNIT_OF_WORK_PORT);
  });

  afterAll(async () => {
    await app.close();
  });

  test('returns readiness 200 against PostgreSQL', async () => {
    await request(app.getHttpServer()).get('/health/readiness').expect(200);
  });

  test('keeps one pool connection and rolls back the transaction on failure', async () => {
    await database.execute(sql`CREATE TEMPORARY TABLE drizzle_transaction_probe (id integer)`);

    await expect(unitOfWork.execute(async (context) => {
      const transaction = context as unknown as DrizzleDatabase;
      await transaction.execute(sql`INSERT INTO drizzle_transaction_probe (id) VALUES (1)`);
      throw new Error('rollback probe');
    })).rejects.toThrow('rollback probe');

    const result = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM drizzle_transaction_probe',
    );
    expect(result.rows[0]?.count).toBe('0');
    expect(pool.options.max).toBe(1);
    expect(pool.totalCount).toBe(1);
  });
});
