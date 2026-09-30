import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, or, sql, type SQL } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import { AuthenticatedSession } from '../../../domain/entities/authenticated-session';
import type {
  AuthenticatedSessionRepositoryPort,
  SessionMatch,
} from '../../../domain/ports/outbound/authenticated-session-repository.port';
import { authenticatedSession as session } from '../schema/identity-access.schema';

type SessionRow = typeof session.$inferSelect;

const toBuffer = (value: Uint8Array): Buffer => Buffer.from(value.buffer, value.byteOffset, value.byteLength);

function toDomain(row: SessionRow): AuthenticatedSession {
  return AuthenticatedSession.restore({ ...row });
}

function toRow(value: AuthenticatedSession): SessionRow {
  return {
    id: value.id,
    accountId: value.accountId,
    tokenDigest: toBuffer(value.tokenDigest),
    previousTokenDigest: value.previousTokenDigest ? toBuffer(value.previousTokenDigest) : null,
    previousValidUntil: value.previousValidUntil,
    remembered: value.remembered,
    idleTimeoutSeconds: value.idleTimeoutSeconds,
    createdAt: value.createdAt,
    lastSeenAt: value.lastSeenAt,
    rotatedAt: value.rotatedAt,
    absoluteExpiresAt: value.absoluteExpiresAt,
  };
}

/** Past the absolute deadline or idle since `last_seen_at` (both exclusive, as in the entity). */
function expired(now: Date): SQL {
  const at = sql`${now.toISOString()}::timestamptz`;
  return sql`(${session.absoluteExpiresAt} <= ${at} or ${session.lastSeenAt} + make_interval(secs => ${session.idleTimeoutSeconds}) <= ${at})`;
}

function matchesDigest(digest: Buffer, now: Date): SQL | undefined {
  return or(
    eq(session.tokenDigest, digest),
    and(eq(session.previousTokenDigest, digest), gt(session.previousValidUntil, now)),
  );
}

@Injectable()
export class DrizzleAuthenticatedSessionRepository implements AuthenticatedSessionRepositoryPort {
  async insertWithinLimit(
    context: TransactionContext,
    value: AuthenticatedSession,
    maxSessions: number,
    now: Date,
  ): Promise<{ evicted: number }> {
    const database = resolveExecutor(context);
    // Serializes concurrent logins of one account across replicas; released at commit/rollback.
    await database.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`auth:session:${value.accountId}`}, 0))`,
    );
    await database.delete(session).where(and(eq(session.accountId, value.accountId), expired(now)));

    const live = await database
      .select({ id: session.id })
      .from(session)
      .where(eq(session.accountId, value.accountId))
      .orderBy(asc(session.lastSeenAt), asc(session.createdAt));
    const excess = Math.max(0, live.length - maxSessions + 1);
    if (excess > 0) {
      // Least recently used first: the sixth login removes the oldest activity (ADR-033).
      await database.delete(session).where(inArray(session.id, live.slice(0, excess).map((row) => row.id)));
    }

    await database.insert(session).values(toRow(value));
    return { evicted: excess };
  }

  async findByDigestForUpdate(context: TransactionContext, digest: Uint8Array, now: Date): Promise<SessionMatch | null> {
    const presented = toBuffer(digest);
    const [row] = await resolveExecutor(context)
      .select()
      .from(session)
      .where(matchesDigest(presented, now))
      .limit(1)
      .for('update');
    if (!row) return null;
    return { session: toDomain(row), matched: row.tokenDigest.equals(presented) ? 'current' : 'previous' };
  }

  async save(context: TransactionContext, value: AuthenticatedSession): Promise<void> {
    const { id, ...changes } = toRow(value);
    await resolveExecutor(context).update(session).set(changes).where(eq(session.id, id));
  }

  async delete(context: TransactionContext, sessionId: string): Promise<void> {
    if (!isUuid(sessionId)) return;
    await resolveExecutor(context).delete(session).where(eq(session.id, sessionId));
  }

  async deleteByDigest(context: TransactionContext, digest: Uint8Array, now: Date): Promise<boolean> {
    const removed = await resolveExecutor(context)
      .delete(session)
      .where(matchesDigest(toBuffer(digest), now))
      .returning({ id: session.id });
    return removed.length > 0;
  }

  async pruneExpired(context: TransactionContext, now: Date, limit: number): Promise<number> {
    const database = resolveExecutor(context);
    const stale = await database
      .select({ id: session.id })
      .from(session)
      .where(expired(now))
      .limit(limit)
      .for('update', { skipLocked: true });
    if (stale.length === 0) return 0;
    const removed = await database
      .delete(session)
      .where(inArray(session.id, stale.map((row) => row.id)))
      .returning({ id: session.id });
    return removed.length;
  }
}
