import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { translateUniqueViolation } from '../../../../../shared/infrastructure/persistence/postgres-errors';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type { ContactVerification } from '../../../domain/entities/contact-verification';
import { RegistrationError } from '../../../domain/errors/registration.error';
import type { VerificationRepositoryPort } from '../../../domain/ports/outbound/persistence.ports';
import { verificationMapper } from '../mappers/registration.mappers';
import { contactVerification } from '../schema/registration.schema';

@Injectable()
export class DrizzleVerificationRepository implements VerificationRepositoryPort {
  async findById(context: TransactionContext, id: string): Promise<ContactVerification | null> {
    if (!isUuid(id)) return null;
    const [row] = await resolveExecutor(context)
      .select()
      .from(contactVerification)
      .where(eq(contactVerification.id, id));
    return row ? verificationMapper.toDomain(row) : null;
  }

  async findForUpdate(context: TransactionContext, id: string): Promise<ContactVerification | null> {
    if (!isUuid(id)) return null;
    const [row] = await resolveExecutor(context)
      .select()
      .from(contactVerification)
      .where(eq(contactVerification.id, id))
      .for('update');
    return row ? verificationMapper.toDomain(row) : null;
  }

  async findActiveByContactForUpdate(
    context: TransactionContext,
    contactHash: Buffer,
  ): Promise<ContactVerification | null> {
    const [row] = await resolveExecutor(context)
      .select()
      .from(contactVerification)
      .where(
        and(
          eq(contactVerification.contactHash, contactHash),
          eq(contactVerification.purpose, 'registration'),
          inArray(contactVerification.status, ['open', 'verified']),
        ),
      )
      .orderBy(desc(contactVerification.createdAt))
      .limit(1)
      .for('update');
    return row ? verificationMapper.toDomain(row) : null;
  }

  async insert(context: TransactionContext, value: ContactVerification): Promise<void> {
    await translateUniqueViolation(
      () => resolveExecutor(context).insert(contactVerification).values(verificationMapper.toRow(value)),
      () => new RegistrationError('CONTACT_UNAVAILABLE'),
    );
  }

  async save(context: TransactionContext, value: ContactVerification): Promise<void> {
    // Identity, contact and delivery key are immutable; only lifecycle columns change.
    await resolveExecutor(context)
      .update(contactVerification)
      .set({
        otpDigest: value.otpDigest,
        expiresAt: value.expiresAt,
        status: value.status,
        failedAttempts: value.failedAttempts,
        resendCount: value.resendCount,
        lockedUntil: value.lockedUntil,
        lastSentAt: value.lastSentAt,
        consumedAt: value.consumedAt,
        updatedAt: new Date(),
      })
      .where(eq(contactVerification.id, value.id));
  }
}
