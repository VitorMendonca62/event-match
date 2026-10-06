import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const LANGUAGE_CATALOG_READER_PORT = Symbol('LANGUAGE_CATALOG_READER_PORT');

export type LanguageSummary = Readonly<{ code: string; label: string; active: boolean }>;

export interface LanguageCatalogReaderPort {
  listActive(context: TransactionContext, locale: 'pt-BR'): Promise<readonly LanguageSummary[]>;
  findByCodes(context: TransactionContext, codes: readonly string[]): Promise<readonly LanguageSummary[]>;
}
