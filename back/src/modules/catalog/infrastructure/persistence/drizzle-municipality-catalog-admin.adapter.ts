import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { MunicipalityCatalogAdminPort, MunicipalityCatalogSnapshotItem } from '../../domain/ports/municipality-catalog-admin.port';
import { federativeUnit, municipality } from './schema/catalog.schema';

@Injectable()
export class DrizzleMunicipalityCatalogAdminAdapter implements MunicipalityCatalogAdminPort {
  async importSnapshot(context: TransactionContext, items: readonly MunicipalityCatalogSnapshotItem[]): Promise<void> {
    const database = resolveExecutor(context);
    if (items.length === 0) return;
    await database.insert(municipality).values(items.map((item) => ({
      code: item.code,
      ufCode: item.ufCode,
      name: item.name,
      normalizedName: item.normalizedName,
      active: item.active,
      sourceVersion: item.sourceVersion,
      sourceReference: item.sourceReference,
      importedAt: new Date(),
    }))).onConflictDoUpdate({
      target: municipality.code,
      set: {
        ufCode: sql`excluded.uf_code`,
        name: sql`excluded.name`,
        normalizedName: sql`excluded.normalized_name`,
        active: sql`excluded.active`,
        sourceVersion: sql`excluded.source_version`,
        sourceReference: sql`excluded.source_reference`,
        importedAt: sql`excluded.imported_at`,
      },
    });
    await database.update(federativeUnit).set({ active: false }).where(sql`${federativeUnit.code} not in (select distinct ${municipality.ufCode} from ${municipality} where ${municipality.active})`);
  }
}
