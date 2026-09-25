import { Inject, Injectable } from '@nestjs/common';

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
    return this.database.transaction((transaction) =>
      work(transaction as unknown as TransactionContext),
    );
  }
}
