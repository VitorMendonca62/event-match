import { Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { ActivityPreferenceCatalogReaderPort, ActivityPreferenceSummary } from '../../domain/ports/activity-preference-catalog-reader.port';
import { activityPreference } from './schema/catalog.schema';

@Injectable()
export class DrizzleActivityPreferenceCatalogReaderAdapter implements ActivityPreferenceCatalogReaderPort {
  listActive(context: TransactionContext, locale: 'pt-BR'): Promise<ActivityPreferenceSummary[]> {
    void locale;
    return resolveExecutor(context)
      .select({ code: activityPreference.code, label: activityPreference.labelPtBr, active: activityPreference.active })
      .from(activityPreference).where(eq(activityPreference.active, true))
      .orderBy(asc(activityPreference.sortOrder), asc(activityPreference.code));
  }

  findByCodes(context: TransactionContext, codes: readonly string[]): Promise<ActivityPreferenceSummary[]> {
    if (codes.length === 0) return Promise.resolve([]);
    return resolveExecutor(context)
      .select({ code: activityPreference.code, label: activityPreference.labelPtBr, active: activityPreference.active })
      .from(activityPreference).where(inArray(activityPreference.code, [...codes]))
      .orderBy(asc(activityPreference.sortOrder), asc(activityPreference.code));
  }
}
