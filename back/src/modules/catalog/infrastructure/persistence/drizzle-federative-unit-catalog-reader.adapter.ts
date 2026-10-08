import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { FederativeUnitCatalogReaderPort, FederativeUnitSummary } from '../../domain/ports/federative-unit-catalog-reader.port';
import { federativeUnit } from './schema/catalog.schema';

@Injectable()
export class DrizzleFederativeUnitCatalogReaderAdapter implements FederativeUnitCatalogReaderPort {
  listActive(context: TransactionContext): Promise<FederativeUnitSummary[]> {
    return resolveExecutor(context)
      .select({ code: federativeUnit.code, name: federativeUnit.name })
      .from(federativeUnit)
      .where(eq(federativeUnit.active, true))
      .orderBy(asc(federativeUnit.name), asc(federativeUnit.code))
      .then((rows) => rows.map((row) => ({ code: row.code as FederativeUnitSummary['code'], name: row.name })));
  }
}
