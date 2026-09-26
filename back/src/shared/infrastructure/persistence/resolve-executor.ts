import type { TransactionContext } from '../../application/ports/unit-of-work.port';
import type { DrizzleDatabase } from './database.types';

export class InvalidTransactionContextError extends Error {
  constructor() {
    super('Invalid transaction context.');
    this.name = 'InvalidTransactionContextError';
  }
}

/** Resolves the opaque context supplied exclusively by DrizzleUnitOfWork (ADR-016). */
export function resolveExecutor(context: TransactionContext): DrizzleDatabase {
  if (context === null || typeof context !== 'object' || !('execute' in context)) {
    throw new InvalidTransactionContextError();
  }

  return context as DrizzleDatabase;
}
