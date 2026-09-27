import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

/**
 * Work appended to a use case's own unit of work, before commit. The HTTP flow uses it to move the
 * continuation session and settle idempotency atomically with the business effect (ADR-021); a
 * throw rolls both back.
 */
export type TransactionHook<T> = (context: TransactionContext, result: T) => Promise<void>;
