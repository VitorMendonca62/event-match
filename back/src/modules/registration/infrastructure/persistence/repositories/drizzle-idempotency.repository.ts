import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { translateUniqueViolation } from '../../../../../shared/infrastructure/persistence/postgres-errors';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { RegistrationError } from '../../../domain/errors/registration.error';
import type {
  FlowOperation,
  IdempotencyRecord,
  NewIdempotencyReservation,
  RegistrationIdempotencyRepositoryPort,
  StoredOutcome,
} from '../../../domain/ports/outbound/flow.ports';
import { registrationIdempotency as idempotency } from '../schema/registration.schema';

@Injectable()
export class DrizzleIdempotencyRepository implements RegistrationIdempotencyRepositoryPort {
  async findForUpdate(
    context: TransactionContext,
    flowSessionId: string,
    operation: FlowOperation,
    keyHash: Buffer,
  ): Promise<IdempotencyRecord | null> {
    const [row] = await resolveExecutor(context)
      .select()
      .from(idempotency)
      .where(
        and(
          eq(idempotency.flowSessionId, flowSessionId),
          eq(idempotency.operation, operation),
          eq(idempotency.keyHash, keyHash),
        ),
      )
      .for('update');
    if (!row) return null;
    return {
      id: row.id,
      flowSessionId: row.flowSessionId,
      operation: row.operation as FlowOperation,
      requestHash: row.requestHash,
      outcome:
        row.completedAt && row.responseBody
          ? { body: row.responseBody as StoredOutcome['body'], rotates: row.rotates }
          : null,
      expiresAt: row.expiresAt,
    };
  }

  async reserve(context: TransactionContext, reservation: NewIdempotencyReservation): Promise<void> {
    await translateUniqueViolation(
      () => resolveExecutor(context).insert(idempotency).values(reservation),
      () => new RegistrationError('IDEMPOTENCY_CONFLICT'),
    );
  }

  async renew(context: TransactionContext, id: string, requestHash: Buffer, expiresAt: Date): Promise<void> {
    await resolveExecutor(context)
      .update(idempotency)
      .set({ requestHash, responseBody: null, rotates: false, completedAt: null, expiresAt, updatedAt: new Date() })
      .where(eq(idempotency.id, id));
  }

  async complete(context: TransactionContext, id: string, outcome: StoredOutcome, expiresAt: Date): Promise<void> {
    const now = new Date();
    await resolveExecutor(context)
      .update(idempotency)
      .set({ responseBody: outcome.body, rotates: outcome.rotates, completedAt: now, expiresAt, updatedAt: now })
      .where(eq(idempotency.id, id));
  }

  async release(context: TransactionContext, id: string): Promise<void> {
    await resolveExecutor(context)
      .delete(idempotency)
      .where(and(eq(idempotency.id, id), isNull(idempotency.completedAt)));
  }
}
