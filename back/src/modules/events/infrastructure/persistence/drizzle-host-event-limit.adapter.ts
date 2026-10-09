import { Injectable } from '@nestjs/common';
import { and, eq, gt, gte, inArray, ne, sql } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { HostEventLimitPort } from '../../domain/ports/host-event-limit.port';
import { event } from './schema/events.schema';

@Injectable()
export class DrizzleHostEventLimitAdapter implements HostEventLimitPort {
  async lockAndCount(context: TransactionContext, input: Readonly<{ hostAccountId: string; now: Date; excludeEventId?: string }>) {
    const database = resolveExecutor(context);
    // A transaction-scoped advisory lock serializes limits without exposing account data to Events.
    await database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.hostAccountId}, 0))`);
    const exclusion = input.excludeEventId ? ne(event.id, input.excludeEventId) : undefined;
    const activeConditions = [eq(event.hostAccountId, input.hostAccountId), inArray(event.status, ['draft', 'published_open']), gt(event.startsAt, input.now), ...(exclusion ? [exclusion] : [])];
    const publishedConditions = [eq(event.hostAccountId, input.hostAccountId), gte(event.publishedAt, new Date(input.now.getTime() - 30 * 24 * 60 * 60_000)), ...(exclusion ? [exclusion] : [])];
    const [active, published] = await Promise.all([
      database.select({ id: event.id }).from(event).where(and(...activeConditions)).limit(1),
      database.select({ count: sql<number>`count(*)` }).from(event).where(and(...publishedConditions)),
    ]);
    return { futureActive: active.length > 0, publishedInWindow: Number(published[0]?.count ?? 0) };
  }
}
