import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const INTEREST_CATALOG_READER_PORT = Symbol('INTEREST_CATALOG_READER_PORT');

export interface InterestRef {
  readonly id: string;
}

/** Public catalog entry (RF006); deactivated interests never leave the adapter. */
export interface InterestSummary {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
}

export interface InterestCatalogReaderPort {
  findActiveByIds(context: TransactionContext, ids: readonly string[]): Promise<InterestRef[]>;
  /** Active interests in stable catalog order (position, then slug). */
  listActive(context: TransactionContext): Promise<InterestSummary[]>;
}
