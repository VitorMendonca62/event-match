import { Injectable } from '@nestjs/common';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { EventAuditPort } from '../../domain/ports/event-audit.port';
import { eventAudit } from '../persistence/schema/events.schema';

@Injectable()
export class DrizzleEventAuditAdapter implements EventAuditPort {
  async record(context: TransactionContext, entry: Parameters<EventAuditPort['record']>[1]): Promise<void> {
    await resolveExecutor(context).insert(eventAudit).values({
      id: crypto.randomUUID(), eventId: entry.eventId, actorAccountId: entry.actorAccountId, action: entry.action,
      changedFields: [...entry.changedFields], correlationId: entry.correlationId, occurredAt: new Date(),
    });
  }
}
