import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import type { StructuredLocation, UfCode } from '../value-objects/location';

export const MUNICIPALITY_CATALOG_READER_PORT = Symbol('MUNICIPALITY_CATALOG_READER_PORT');

export type MunicipalitySummary = Readonly<StructuredLocation & { active: boolean; timeZone?: string }>;

export interface MunicipalityCatalogReaderPort {
  searchActive(
    context: TransactionContext,
    input: Readonly<{ ufCode: UfCode; query?: string }>,
  ): Promise<readonly MunicipalitySummary[]>;
  findByCodeAndUf(
    context: TransactionContext,
    input: Readonly<{ ufCode: UfCode; municipalityCode: string }>,
  ): Promise<MunicipalitySummary | null>;
}
