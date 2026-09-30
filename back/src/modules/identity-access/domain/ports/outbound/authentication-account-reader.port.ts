import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { AccountStatus } from '../../value-objects/account-access';

export const AUTHENTICATION_ACCOUNT_READER_PORT = Symbol('AUTHENTICATION_ACCOUNT_READER_PORT');

/** Read-only projection of the account produced by registration; never the contact itself. */
export interface AuthenticationAccount {
  readonly accountId: string;
  readonly status: AccountStatus;
  /** Argon2id PHC string; `null` when the account holds no password. */
  readonly passwordHash: string | null;
}

export interface AuthenticationAccountReaderPort {
  /** Looks the account up by the blind index of its confirmed, held e-mail contact. */
  findByEmailHash(context: TransactionContext, emailHash: Uint8Array): Promise<AuthenticationAccount | null>;
  /** Current state for live authorization; `null` when the account no longer exists. */
  findStatus(context: TransactionContext, accountId: string): Promise<AccountStatus | null>;
}
