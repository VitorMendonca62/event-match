import { Injectable } from '@nestjs/common';
import { and, eq, inArray, lte } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { translateUniqueViolation } from '../../../../../shared/infrastructure/persistence/postgres-errors';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type { Account } from '../../../domain/entities/account';
import { RegistrationError } from '../../../domain/errors/registration.error';
import type {
  AccountRepositoryPort,
  NewIncompleteAccount,
} from '../../../domain/ports/outbound/persistence.ports';
import type { ContactChannel } from '../../../domain/value-objects/contact-identifier';
import { accountMapper } from '../mappers/registration.mappers';
import { account, accountContact, accountCredential } from '../schema/registration.schema';

const PASSWORD_ALGORITHM = 'argon2id';
const incomplete = eq(account.status, 'account_incomplete');

@Injectable()
export class DrizzleAccountRepository implements AccountRepositoryPort {
  async findHoldingContactForUpdate(
    context: TransactionContext,
    channel: ContactChannel,
    contactHash: Buffer,
  ): Promise<Account | null> {
    const [row] = await resolveExecutor(context)
      .select({ account })
      .from(accountContact)
      .innerJoin(account, eq(account.id, accountContact.accountId))
      .where(
        and(
          eq(accountContact.channel, channel),
          eq(accountContact.contactHash, contactHash),
          eq(accountContact.holdsContact, true),
        ),
      )
      .for('update', { of: account });
    return row ? accountMapper.toDomain(row.account) : null;
  }

  async findForUpdate(context: TransactionContext, id: string): Promise<Account | null> {
    if (!isUuid(id)) return null;
    const [row] = await resolveExecutor(context)
      .select()
      .from(account)
      .where(eq(account.id, id))
      .for('update');
    return row ? accountMapper.toDomain(row) : null;
  }

  async insertIncomplete(context: TransactionContext, input: NewIncompleteAccount): Promise<void> {
    const database = resolveExecutor(context);
    const { account: value, channel, retained } = input;
    await database.insert(account).values(accountMapper.toRow(value));
    await translateUniqueViolation(
      () =>
        database.insert(accountContact).values({
          accountId: value.id,
          channel,
          contactHash: retained.contactHash,
          contactCiphertext: retained.contactCiphertext,
          keyVersion: retained.keyVersion,
          confirmedAt: value.lastUpdatedAt,
          holdsContact: true,
        }),
      () => new RegistrationError('CONTACT_UNAVAILABLE'),
    );
    await database.insert(accountCredential).values({
      accountId: value.id,
      passwordHash: retained.passwordHash,
      algorithm: PASSWORD_ALGORITHM,
      updatedAt: value.lastUpdatedAt,
    });
  }

  async activate(context: TransactionContext, value: Account): Promise<boolean> {
    const activated = await resolveExecutor(context)
      .update(account)
      .set({
        status: value.status,
        birthDate: value.birthDate?.value ?? null,
        lastUpdatedAt: value.lastUpdatedAt,
        activatedAt: value.activatedAt,
      })
      .where(and(eq(account.id, value.id), incomplete))
      .returning({ id: account.id });
    return activated.length === 1;
  }

  async expire(context: TransactionContext, value: Account): Promise<void> {
    const database = resolveExecutor(context);
    await database
      .update(account)
      .set({
        status: value.status,
        birthDate: null,
        lastUpdatedAt: value.lastUpdatedAt,
        expiredAt: value.expiredAt,
      })
      .where(eq(account.id, value.id));
    await this.releaseSensitiveData(context, [value.id]);
  }

  async expireStale(
    context: TransactionContext,
    staleBefore: Date,
    now: Date,
    batch: number,
  ): Promise<string[]> {
    const database = resolveExecutor(context);
    const stale = await database
      .select({ id: account.id })
      .from(account)
      .where(and(incomplete, lte(account.lastUpdatedAt, staleBefore)))
      .limit(batch)
      .for('update', { skipLocked: true });
    if (stale.length === 0) return [];

    const expired = await database
      .update(account)
      .set({ status: 'expired', birthDate: null, expiredAt: now, lastUpdatedAt: now })
      .where(inArray(account.id, stale.map((row) => row.id)))
      .returning({ id: account.id });
    const ids = expired.map((row) => row.id);
    await this.releaseSensitiveData(context, ids);
    return ids;
  }

  /** ADR-017: frees the contact for a new registration and discards the credential. */
  private async releaseSensitiveData(context: TransactionContext, accountIds: string[]): Promise<void> {
    if (accountIds.length === 0) return;
    const database = resolveExecutor(context);
    await database
      .update(accountContact)
      .set({ contactHash: null, contactCiphertext: null, holdsContact: false })
      .where(inArray(accountContact.accountId, accountIds));
    await database
      .update(accountCredential)
      .set({ passwordHash: null, updatedAt: new Date() })
      .where(inArray(accountCredential.accountId, accountIds));
  }
}
