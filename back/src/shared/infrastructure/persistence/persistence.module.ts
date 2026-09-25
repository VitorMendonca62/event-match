import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { BackendEnv } from '../config/env';
import { DATABASE_READINESS_PORT } from '../../application/ports/database-readiness.port';
import { UNIT_OF_WORK_PORT } from '../../application/ports/unit-of-work.port';
import type { DrizzleDatabase, PostgresPool } from './database.types';
import { DatabaseReadinessAdapter } from './database-readiness.adapter';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work';
import { attachPostgresPoolErrorHandler } from './postgres-pool-error-handler';
import { PostgresPoolLifecycle } from './postgres-pool-lifecycle';
import { DRIZZLE_DB, PG_POOL } from './tokens';

const poolProvider = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService<BackendEnv, true>): PostgresPool => {
    const pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: config.getOrThrow<number>('DATABASE_POOL_MAX'),
      idleTimeoutMillis: config.getOrThrow<number>('DATABASE_IDLE_TIMEOUT_MS'),
      connectionTimeoutMillis: config.getOrThrow<number>('DATABASE_CONNECTION_TIMEOUT_MS'),
      statement_timeout: config.getOrThrow<number>('DATABASE_STATEMENT_TIMEOUT_MS'),
      ssl:
        config.getOrThrow<string>('DATABASE_SSL_MODE') === 'require'
          ? { rejectUnauthorized: true }
          : false,
    });

    attachPostgresPoolErrorHandler(pool);

    return pool;
  },
};

const drizzleProvider = {
  provide: DRIZZLE_DB,
  inject: [PG_POOL],
  useFactory: (pool: PostgresPool): DrizzleDatabase => drizzle({ client: pool }),
};

@Module({
  imports: [ConfigModule],
  providers: [
    poolProvider,
    drizzleProvider,
    PostgresPoolLifecycle,
    DatabaseReadinessAdapter,
    DrizzleUnitOfWork,
    { provide: DATABASE_READINESS_PORT, useExisting: DatabaseReadinessAdapter },
    { provide: UNIT_OF_WORK_PORT, useExisting: DrizzleUnitOfWork },
  ],
  exports: [PG_POOL, DRIZZLE_DB, DATABASE_READINESS_PORT, UNIT_OF_WORK_PORT],
})
export class PersistenceModule {}
