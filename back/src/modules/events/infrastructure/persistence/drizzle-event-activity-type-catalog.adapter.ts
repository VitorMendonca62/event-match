import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { EventActivityTypeCatalogPort } from '../../domain/ports/event-activity-type-catalog.port';
import { eventActivityType } from './schema/events.schema';

@Injectable()
export class DrizzleEventActivityTypeCatalogAdapter implements EventActivityTypeCatalogPort {
  async findByCode(context: TransactionContext, code: string) {
    const [row] = await resolveExecutor(context).select({ code: eventActivityType.code, label: eventActivityType.labelPtBr, active: eventActivityType.active }).from(eventActivityType).where(eq(eventActivityType.code, code)).limit(1);
    return row ?? null;
  }
}
