import { Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type { RegistrationFlowSession } from '../../../domain/entities/registration-flow-session';
import type { RegistrationFlowSessionRepositoryPort } from '../../../domain/ports/outbound/flow.ports';
import { flowSessionMapper } from '../mappers/registration.mappers';
import { registrationFlowSession as session } from '../schema/registration.schema';

const active = (now: Date) =>
  and(isNull(session.revokedAt), isNotNull(session.tokenDigest), gt(session.expiresAt, now));

@Injectable()
export class DrizzleFlowSessionRepository implements RegistrationFlowSessionRepositoryPort {
  async insert(context: TransactionContext, value: RegistrationFlowSession): Promise<void> {
    await resolveExecutor(context).insert(session).values(flowSessionMapper.toRow(value));
  }

  async findByTokenForUpdate(
    context: TransactionContext,
    tokenDigest: Buffer,
    now: Date,
  ): Promise<RegistrationFlowSession | null> {
    const [row] = await resolveExecutor(context)
      .select()
      .from(session)
      .where(
        and(
          active(now),
          or(
            eq(session.tokenDigest, tokenDigest),
            and(eq(session.previousTokenDigest, tokenDigest), gt(session.previousValidUntil, now)),
          ),
        ),
      )
      .limit(1)
      .for('update');
    return row ? flowSessionMapper.toDomain(row) : null;
  }

  async findByIdForUpdate(context: TransactionContext, id: string): Promise<RegistrationFlowSession | null> {
    if (!isUuid(id)) return null;
    const [row] = await resolveExecutor(context).select().from(session).where(eq(session.id, id)).for('update');
    return row ? flowSessionMapper.toDomain(row) : null;
  }

  async findPendingByVerificationForUpdate(
    context: TransactionContext,
    verificationId: string,
    now: Date,
  ): Promise<RegistrationFlowSession | null> {
    if (!isUuid(verificationId)) return null;
    const [row] = await resolveExecutor(context)
      .select()
      .from(session)
      .where(
        and(active(now), eq(session.stage, 'verification_pending'), eq(session.verificationId, verificationId)),
      )
      .limit(1)
      .for('update');
    return row ? flowSessionMapper.toDomain(row) : null;
  }

  async save(context: TransactionContext, value: RegistrationFlowSession): Promise<void> {
    const { id, ...changes } = flowSessionMapper.toRow(value);
    await resolveExecutor(context).update(session).set(changes).where(eq(session.id, id));
  }

  async expireStale(context: TransactionContext, now: Date, batch: number): Promise<number> {
    const database = resolveExecutor(context);
    const stale = await database
      .select({ id: session.id })
      .from(session)
      .where(and(isNotNull(session.tokenDigest), lte(session.expiresAt, now)))
      .limit(batch)
      .for('update', { skipLocked: true });
    if (stale.length === 0) return 0;

    const expired = await database
      .update(session)
      .set({ tokenDigest: null, previousTokenDigest: null, previousValidUntil: null, updatedAt: now })
      .where(inArray(session.id, stale.map((row) => row.id)))
      .returning({ id: session.id });
    return expired.length;
  }
}
