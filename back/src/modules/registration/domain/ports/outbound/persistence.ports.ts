import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { Account } from '../../entities/account';
import type { ContactVerification } from '../../entities/contact-verification';
import type { Registration } from '../../entities/registration';
import type { ContactChannel } from '../../value-objects/contact-identifier';

export const VERIFICATION_REPOSITORY_PORT = Symbol('VERIFICATION_REPOSITORY_PORT');
export const REGISTRATION_REPOSITORY_PORT = Symbol('REGISTRATION_REPOSITORY_PORT');
export const ACCOUNT_REPOSITORY_PORT = Symbol('ACCOUNT_REPOSITORY_PORT');
export const RATE_LIMIT_REPOSITORY_PORT = Symbol('RATE_LIMIT_REPOSITORY_PORT');
export const TERMS_REPOSITORY_PORT = Symbol('TERMS_REPOSITORY_PORT');

export interface VerificationRepositoryPort {
  findOpenForUpdate(context: TransactionContext, contactHash: Buffer): Promise<ContactVerification | null>;
  findForUpdate(context: TransactionContext, id: string): Promise<ContactVerification | null>;
  insert(context: TransactionContext, verification: ContactVerification): Promise<void>;
  save(context: TransactionContext, verification: ContactVerification): Promise<void>;
  expireOpen(context: TransactionContext, contactHash: Buffer, now: Date): Promise<void>;
}
export interface RegistrationRepositoryPort {
  findInProgressForUpdate(context: TransactionContext, id: string): Promise<Registration | null>;
  insert(context: TransactionContext, registration: Registration): Promise<void>;
  save(context: TransactionContext, registration: Registration): Promise<void>;
  expireStale(context: TransactionContext, now: Date, batch: number): Promise<number>;
}
export interface AccountRepositoryPort {
  existsHoldingContact(context: TransactionContext, channel: ContactChannel, hash: Buffer): Promise<boolean>;
  insertIncomplete(context: TransactionContext, input: { account: Account; channel: ContactChannel; contactHash: Buffer; ciphertext: Buffer; keyVersion: number; passwordHash: string }): Promise<void>;
  findForUpdate(context: TransactionContext, accountId: string): Promise<Account | null>;
  save(context: TransactionContext, account: Account): Promise<void>;
  expireStale(context: TransactionContext, now: Date, batch: number): Promise<number>;
}
export interface RateLimitRepositoryPort {
  tryConsume(context: TransactionContext, scope: 'contact' | 'origin', subjectHash: Buffer, windowStart: Date, kind: 'challenge' | 'resend', limit: number): Promise<boolean>;
}
export interface ApprovedTermsDocument { id: string; kind: 'terms' | 'privacy' | 'community_rules'; }
export interface TermsRepositoryPort {
  findApproved(context: TransactionContext, documentIds: string[]): Promise<ApprovedTermsDocument[]>;
  recordAcceptances(context: TransactionContext, accountId: string, documentIds: string[], acceptedAt: Date): Promise<void>;
}
