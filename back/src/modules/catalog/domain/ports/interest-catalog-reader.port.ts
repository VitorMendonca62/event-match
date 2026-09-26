import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const INTEREST_CATALOG_READER_PORT = Symbol('INTEREST_CATALOG_READER_PORT');

export interface InterestRef {
  readonly id: string;
}

export interface InterestCatalogReaderPort {
  findActiveByIds(context: TransactionContext, ids: readonly string[]): Promise<InterestRef[]>;
}
