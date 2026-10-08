import { Injectable } from '@nestjs/common';
import { and, asc, eq, like } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { MunicipalityCatalogReaderPort, MunicipalitySummary } from '../../domain/ports/municipality-catalog-reader.port';
import { isUfCode, type UfCode } from '../../domain/value-objects/location';
import { municipality } from './schema/catalog.schema';

const LIMIT = 20;

function normalizeQuery(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR');
}

function selectShape() {
  return {
    municipalityCode: municipality.code,
    municipalityName: municipality.name,
    ufCode: municipality.ufCode,
    active: municipality.active,
  } as const;
}

function mapRow(row: { municipalityCode: string; municipalityName: string; ufCode: string; active: boolean }): MunicipalitySummary {
  if (!isUfCode(row.ufCode)) throw new Error('Catalog contains an invalid federative unit code.');
  return { municipalityCode: row.municipalityCode, municipalityName: row.municipalityName, ufCode: row.ufCode, active: row.active };
}

@Injectable()
export class DrizzleMunicipalityCatalogReaderAdapter implements MunicipalityCatalogReaderPort {
  async searchActive(
    context: TransactionContext,
    input: Readonly<{ ufCode: UfCode; query?: string }>,
  ): Promise<MunicipalitySummary[]> {
    const normalized = input.query ? normalizeQuery(input.query) : undefined;
    const conditions = [eq(municipality.ufCode, input.ufCode), eq(municipality.active, true)];
    if (normalized) conditions.push(like(municipality.normalizedName, `%${normalized}%`));
    const rows = await resolveExecutor(context)
      .select(selectShape())
      .from(municipality)
      .where(and(...conditions))
      .orderBy(asc(municipality.name), asc(municipality.code))
      .limit(LIMIT);
    return rows.map(mapRow);
  }

  async findByCodeAndUf(
    context: TransactionContext,
    input: Readonly<{ ufCode: UfCode; municipalityCode: string }>,
  ): Promise<MunicipalitySummary | null> {
    const [row] = await resolveExecutor(context)
      .select(selectShape())
      .from(municipality)
      .where(and(eq(municipality.code, input.municipalityCode), eq(municipality.ufCode, input.ufCode)))
      .limit(1);
    return row ? mapRow(row) : null;
  }
}
