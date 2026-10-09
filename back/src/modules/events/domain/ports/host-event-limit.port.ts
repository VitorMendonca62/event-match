import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const HOST_EVENT_LIMIT_PORT = Symbol('HOST_EVENT_LIMIT_PORT');

export type HostEventLimitSnapshot = Readonly<{ futureActive: boolean; publishedInWindow: number }>;

export interface HostEventLimitPort {
  lockAndCount(context: TransactionContext, input: Readonly<{ hostAccountId: string; now: Date; excludeEventId?: string }>): Promise<HostEventLimitSnapshot>;
}
