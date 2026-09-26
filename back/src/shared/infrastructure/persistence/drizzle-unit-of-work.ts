import { Inject, Injectable } from '@nestjs/common';

import type {
  TransactionContext,
  UnitOfWorkPort,
} from '../../application/ports/unit-of-work.port';
import type { DrizzleDatabase } from './database.types';
import { DRIZZLE_DB } from './tokens';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleUnitOfWork implements UnitOfWorkPort {
  constructor(@Inject(DRIZZLE_DB) private readonly database: DrizzleDatabase) {}

  execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => {
      // Lightweight test doubles intentionally model only the transaction boundary.
      if ('execute' in transaction && typeof transaction.execute === 'function') {
        await transaction.execute(sql`set local lock_timeout = '2s'`);
      }
      return work(transaction as unknown as TransactionContext);
    });
  }
}
