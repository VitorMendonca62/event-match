import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import type { UfCode } from '../value-objects/location';

export const FEDERATIVE_UNIT_CATALOG_READER_PORT = Symbol('FEDERATIVE_UNIT_CATALOG_READER_PORT');

export type FederativeUnitSummary = Readonly<{
  code: UfCode;
  name: string;
}>;

export interface FederativeUnitCatalogReaderPort {
  listActive(context: TransactionContext): Promise<readonly FederativeUnitSummary[]>;
}
