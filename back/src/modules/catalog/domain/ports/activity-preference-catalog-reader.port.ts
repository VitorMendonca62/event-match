import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const ACTIVITY_PREFERENCE_CATALOG_READER_PORT = Symbol('ACTIVITY_PREFERENCE_CATALOG_READER_PORT');

export type ActivityPreferenceSummary = Readonly<{ code: string; label: string; active: boolean }>;

export interface ActivityPreferenceCatalogReaderPort {
  listActive(context: TransactionContext, locale: 'pt-BR'): Promise<readonly ActivityPreferenceSummary[]>;
  findByCodes(context: TransactionContext, codes: readonly string[]): Promise<readonly ActivityPreferenceSummary[]>;
}
