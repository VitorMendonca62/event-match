import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gt, inArray, lte, sql } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { DrizzleDatabase } from '../../../../../shared/infrastructure/persistence/database.types';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type {
  AuthenticationAttemptRepositoryPort,
  LoginAttemptReservation,
  LoginAttemptReservationInput,
} from '../../../domain/ports/outbound/authentication-attempt-repository.port';
import { authenticationAttempt as attempt } from '../schema/identity-access.schema';

type Scope = 'contact' | 'origin';

const PRUNE_BATCH = 100;

const toBuffer = (value: Uint8Array): Buffer => Buffer.from(value.buffer, value.byteOffset, value.byteLength);

/**
 * Exact sliding window in PostgreSQL (ADR-035). Each subject is serialized by a transactional
 * advisory lock, always contact before origin so two logins never deadlock; expired attempts of
 * the subject are removed, the window is counted and, only when both buckets allow, one attempt
 * is recorded in each.
 */
@Injectable()
export class DrizzleAuthenticationAttemptRepository implements AuthenticationAttemptRepositoryPort {
  async reserve(context: TransactionContext, input: LoginAttemptReservationInput): Promise<LoginAttemptReservation> {
    const database = resolveExecutor(context);
    const windowStart = new Date(input.now.getTime() - input.windowMs);
    const buckets: readonly [Scope, Buffer, number][] = [
      ['contact', toBuffer(input.contactSubject), input.contactLimit],
      ['origin', toBuffer(input.originSubject), input.originLimit],
    ];

    await this.pruneExpired(database, windowStart);
    for (const [scope, subject] of buckets) await this.lock(database, scope, subject);

    for (const [scope, subject, limit] of buckets) {
      await database
        .delete(attempt)
        .where(and(eq(attempt.scope, scope), eq(attempt.subjectHash, subject), lte(attempt.attemptedAt, windowStart)));
      const [row] = await database
        .select({ attempts: count() })
        .from(attempt)
        .where(and(eq(attempt.scope, scope), eq(attempt.subjectHash, subject), gt(attempt.attemptedAt, windowStart)));
      if ((row?.attempts ?? 0) >= limit) return { outcome: scope === 'contact' ? 'contact_limited' : 'origin_limited' };
    }

    const rows = buckets.map(([scope, subject]) => ({
      id: randomUUID(),
      scope,
      subjectHash: subject,
      attemptedAt: input.now,
    }));
    await database.insert(attempt).values(rows);
    return { outcome: 'allowed', reservationIds: rows.map((row) => row.id) };
  }

  async release(context: TransactionContext, reservationIds: readonly string[]): Promise<void> {
    const ids = reservationIds.filter(isUuid);
    if (ids.length === 0) return;
    await resolveExecutor(context).delete(attempt).where(inArray(attempt.id, ids));
  }

  /** Removes a small global batch so subjects that never return do not accumulate forever. */
  private async pruneExpired(database: DrizzleDatabase, windowStart: Date): Promise<void> {
    const stale = await database
      .select({ id: attempt.id })
      .from(attempt)
      .where(lte(attempt.attemptedAt, windowStart))
      .orderBy(asc(attempt.attemptedAt), asc(attempt.id))
      .limit(PRUNE_BATCH)
      .for('update', { skipLocked: true });
    if (stale.length === 0) return;
    await database.delete(attempt).where(inArray(attempt.id, stale.map((row) => row.id)));
  }

  private async lock(database: DrizzleDatabase, scope: Scope, subject: Buffer): Promise<void> {
    await database.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`auth:login:${scope}:${subject.toString('hex')}`}, 0))`,
    );
  }
}
