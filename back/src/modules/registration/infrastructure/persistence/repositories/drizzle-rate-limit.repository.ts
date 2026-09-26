import { Injectable } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import type {
  RateLimitKind,
  RateLimitRepositoryPort,
  RateLimitScope,
} from '../../../domain/ports/outbound/persistence.ports';
import { verificationRateWindow } from '../schema/registration.schema';

const RETAINED_WINDOW_MS = 2 * 60 * 60_000;

@Injectable()
export class DrizzleRateLimitRepository implements RateLimitRepositoryPort {
  /** ADR-015: opportunistic cleanup of the subject plus one conditional upsert. */
  async tryConsume(
    context: TransactionContext,
    scope: RateLimitScope,
    subjectHash: Buffer,
    windowStart: Date,
    kind: RateLimitKind,
    limit: number,
  ): Promise<boolean> {
    const database = resolveExecutor(context);
    await database
      .delete(verificationRateWindow)
      .where(
        and(
          eq(verificationRateWindow.scope, scope),
          eq(verificationRateWindow.subjectHash, subjectHash),
          lt(verificationRateWindow.windowStart, new Date(windowStart.getTime() - RETAINED_WINDOW_MS)),
        ),
      );

    const counter =
      kind === 'challenge' ? verificationRateWindow.requestCount : verificationRateWindow.resendCount;
    const consumed = await database
      .insert(verificationRateWindow)
      .values({
        scope,
        subjectHash,
        windowStart,
        requestCount: kind === 'challenge' ? 1 : 0,
        resendCount: kind === 'resend' ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [
          verificationRateWindow.scope,
          verificationRateWindow.subjectHash,
          verificationRateWindow.windowStart,
        ],
        set: { [kind === 'challenge' ? 'requestCount' : 'resendCount']: sql`${counter} + 1` },
        setWhere: lt(counter, limit),
      })
      .returning({ count: counter });
    return consumed.length === 1;
  }
}
