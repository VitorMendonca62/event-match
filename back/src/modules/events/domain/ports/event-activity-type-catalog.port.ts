import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const EVENT_ACTIVITY_TYPE_CATALOG_PORT = Symbol('EVENT_ACTIVITY_TYPE_CATALOG_PORT');

export type EventActivityTypeSummary = Readonly<{ code: string; label: string; active: boolean }>;

export interface EventActivityTypeCatalogPort {
  findByCode(context: TransactionContext, code: string): Promise<EventActivityTypeSummary | null>;
}
