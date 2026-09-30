import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type {
  AuthenticationAccount,
  AuthenticationAccountReaderPort,
} from '../../../domain/ports/outbound/authentication-account-reader.port';
import { type AccountStatus, isAccountStatus } from '../../../domain/value-objects/account-access';
import {
  accountContactProjection as contact,
  accountCredentialProjection as credential,
  accountProjection as account,
} from '../account-projection';

const toBuffer = (value: Uint8Array): Buffer => Buffer.from(value.buffer, value.byteOffset, value.byteLength);

/** Unknown status strings are treated as a missing account: deny by default (ADR-036). */
const knownStatus = (status: string): AccountStatus | null => (isAccountStatus(status) ? status : null);

@Injectable()
export class DrizzleAuthenticationAccountReader implements AuthenticationAccountReaderPort {
  async findByEmailHash(context: TransactionContext, emailHash: Uint8Array): Promise<AuthenticationAccount | null> {
    const [row] = await resolveExecutor(context)
      .select({ accountId: account.id, status: account.status, passwordHash: credential.passwordHash })
      .from(contact)
      .innerJoin(account, eq(account.id, contact.accountId))
      .leftJoin(credential, eq(credential.accountId, account.id))
      .where(and(eq(contact.channel, 'email'), eq(contact.holdsContact, true), eq(contact.contactHash, toBuffer(emailHash))))
      .limit(1);
    const status = row ? knownStatus(row.status) : null;
    if (!row || !status) return null;
    return { accountId: row.accountId, status, passwordHash: row.passwordHash };
  }

  async findStatus(context: TransactionContext, accountId: string): Promise<AccountStatus | null> {
    if (!isUuid(accountId)) return null;
    const [row] = await resolveExecutor(context)
      .select({ status: account.status })
      .from(account)
      .where(eq(account.id, accountId));
    return row ? knownStatus(row.status) : null;
  }
}
