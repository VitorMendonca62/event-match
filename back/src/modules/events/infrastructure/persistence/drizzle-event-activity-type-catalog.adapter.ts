import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { EventActivityTypeCatalogPort } from '../../domain/ports/event-activity-type-catalog.port';
import { eventActivityType } from './schema/events.schema';

@Injectable()
export class DrizzleEventActivityTypeCatalogAdapter implements EventActivityTypeCatalogPort {
  listActive(context: TransactionContext, locale: 'pt-BR') {
    void locale;
    return resolveExecutor(context).select({ code: eventActivityType.code, label: eventActivityType.labelPtBr, active: eventActivityType.active })
      .from(eventActivityType).where(eq(eventActivityType.active, true)).orderBy(asc(eventActivityType.sortOrder), asc(eventActivityType.code)).limit(100);
  }

  async findByCode(context: TransactionContext, code: string) {
    const [row] = await resolveExecutor(context).select({ code: eventActivityType.code, label: eventActivityType.labelPtBr, active: eventActivityType.active }).from(eventActivityType).where(eq(eventActivityType.code, code)).limit(1);
    return row ?? null;
  }
}
