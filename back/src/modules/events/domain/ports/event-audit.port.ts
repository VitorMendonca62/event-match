import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const EVENT_AUDIT_PORT = Symbol('EVENT_AUDIT_PORT');

export type EventAuditAction = 'draft_created' | 'draft_updated' | 'published';
export type EventAuditEntry = Readonly<{ eventId: string; actorAccountId: string; action: EventAuditAction; changedFields: readonly string[]; correlationId: string }>;

export interface EventAuditPort {
  record(context: TransactionContext, entry: EventAuditEntry): Promise<void>;
}
