import { Injectable } from '@nestjs/common';
import { and, eq, inArray, lte } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { translateUniqueViolation } from '../../../../../shared/infrastructure/persistence/postgres-errors';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type { Registration } from '../../../domain/entities/registration';
import { RegistrationError } from '../../../domain/errors/registration.error';
import type { RegistrationRepositoryPort } from '../../../domain/ports/outbound/persistence.ports';
import { registrationMapper } from '../mappers/registration.mappers';
import { registration } from '../schema/registration.schema';

const inProgress = eq(registration.status, 'registration_in_progress');

@Injectable()
export class DrizzleRegistrationRepository implements RegistrationRepositoryPort {
  async findInProgressForUpdate(context: TransactionContext, id: string): Promise<Registration | null> {
    if (!isUuid(id)) return null;
    const [row] = await resolveExecutor(context)
      .select()
      .from(registration)
      .where(and(eq(registration.id, id), inProgress))
      .for('update');
    return row ? registrationMapper.toDomain(row) : null;
  }

  async findInProgressByContactForUpdate(
    context: TransactionContext,
    contactHash: Buffer,
  ): Promise<Registration | null> {
    const [row] = await resolveExecutor(context)
      .select()
      .from(registration)
      .where(and(eq(registration.contactHash, contactHash), inProgress))
      .for('update');
    return row ? registrationMapper.toDomain(row) : null;
  }

  async insert(context: TransactionContext, value: Registration): Promise<void> {
    await translateUniqueViolation(
      () => resolveExecutor(context).insert(registration).values(registrationMapper.toRow(value)),
      () => new RegistrationError('CONTACT_UNAVAILABLE'),
    );
  }

  async save(context: TransactionContext, value: Registration): Promise<void> {
    const row = registrationMapper.toRow(value);
    await resolveExecutor(context)
      .update(registration)
      .set({
        status: row.status,
        contactHash: row.contactHash,
        contactCiphertext: row.contactCiphertext,
        keyVersion: row.keyVersion,
        passwordHash: row.passwordHash,
        lastUpdatedAt: row.lastUpdatedAt,
        expiredAt: row.expiredAt,
      })
      .where(eq(registration.id, row.id));
  }

  async expireStale(context: TransactionContext, now: Date, batch: number): Promise<number> {
    const database = resolveExecutor(context);
    const stale = await database
      .select({ id: registration.id })
      .from(registration)
      .where(and(inProgress, lte(registration.expiresAt, now)))
      .limit(batch)
      .for('update', { skipLocked: true });
    if (stale.length === 0) return 0;

    // Same transition as Registration.expire(): nulls sensitive data and releases the contact.
    const expired = await database
      .update(registration)
      .set({
        status: 'expired',
        contactHash: null,
        contactCiphertext: null,
        keyVersion: null,
        passwordHash: null,
        expiredAt: now,
        lastUpdatedAt: now,
      })
      .where(inArray(registration.id, stale.map((row) => row.id)))
      .returning({ id: registration.id });
    return expired.length;
  }
}
