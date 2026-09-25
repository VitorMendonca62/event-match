import { Inject, Injectable } from '@nestjs/common';

import type {
  DatabaseReadinessPort,
  DatabaseReadinessResult,
} from '../../application/ports/database-readiness.port';
import { PG_POOL } from './tokens';
import type { PostgresPool } from './database.types';

@Injectable()
export class DatabaseReadinessAdapter implements DatabaseReadinessPort {
  constructor(@Inject(PG_POOL) private readonly pool: PostgresPool) {}

  async check(): Promise<DatabaseReadinessResult> {
    const startedAt = performance.now();

    await this.pool.query('SELECT 1');

    return {
      status: 'up',
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}
