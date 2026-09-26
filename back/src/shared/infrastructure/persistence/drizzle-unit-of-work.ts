import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type {
  TransactionContext,
  UnitOfWorkPort,
} from '../../application/ports/unit-of-work.port';
import type { DrizzleDatabase } from './database.types';
import { DRIZZLE_DB } from './tokens';

@Injectable()
export class DrizzleUnitOfWork implements UnitOfWorkPort {
  constructor(@Inject(DRIZZLE_DB) private readonly database: DrizzleDatabase) {}

  execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => {
      // ADR-016: short waits only, since the pool has a single connection.
      await transaction.execute(sql`set local lock_timeout = '2s'`);
      return work(transaction as unknown as TransactionContext);
    });
  }
}
