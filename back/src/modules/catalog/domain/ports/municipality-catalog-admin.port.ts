import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import type { UfCode } from '../value-objects/location';

export const MUNICIPALITY_CATALOG_ADMIN_PORT = Symbol('MUNICIPALITY_CATALOG_ADMIN_PORT');

export type MunicipalityCatalogSnapshotItem = Readonly<{
  code: string;
  ufCode: UfCode;
  name: string;
  normalizedName: string;
  active: boolean;
  sourceVersion: string;
  sourceReference: string;
}>;

/** Administrative import port. HTTP requests never call the IBGE or this port. */
export interface MunicipalityCatalogAdminPort {
  importSnapshot(
    context: TransactionContext,
    items: readonly MunicipalityCatalogSnapshotItem[],
  ): Promise<void>;
}
