import type { TransactionContext } from '../../application/ports/unit-of-work.port';
import type { DrizzleDatabase } from './database.types';

/** Resolves the opaque context supplied exclusively by DrizzleUnitOfWork. */
export function resolveExecutor(context: TransactionContext): DrizzleDatabase {
  if (context === null || typeof context !== 'object') {
    throw new Error('Invalid transaction context.');
  }

  return context as DrizzleDatabase;
}
