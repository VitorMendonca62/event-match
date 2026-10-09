import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const HOST_ELIGIBILITY_PORT = Symbol('HOST_ELIGIBILITY_PORT');

/** Minimal, live projection consumed by Events without importing Profile internals. */
export interface HostEligibilityPort {
  isEligible(context: TransactionContext, accountId: string): Promise<boolean>;
}
