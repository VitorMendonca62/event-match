import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { Account } from '../../entities/account';
import type { ContactVerification } from '../../entities/contact-verification';
import type { Registration, RetainedRegistrationData } from '../../entities/registration';
import type { ContactChannel } from '../../value-objects/contact-identifier';
import type { TermsDocumentKind } from '../../value-objects/terms-document-kind';

export const VERIFICATION_REPOSITORY_PORT = Symbol('VERIFICATION_REPOSITORY_PORT');
export const REGISTRATION_REPOSITORY_PORT = Symbol('REGISTRATION_REPOSITORY_PORT');
export const ACCOUNT_REPOSITORY_PORT = Symbol('ACCOUNT_REPOSITORY_PORT');
export const RATE_LIMIT_REPOSITORY_PORT = Symbol('RATE_LIMIT_REPOSITORY_PORT');
export const TERMS_REPOSITORY_PORT = Symbol('TERMS_REPOSITORY_PORT');

/**
 * Persistence ports for the registration context (ADR-016). Methods run inside the caller's
 * unit of work and translate unique violations into `RegistrationError('CONTACT_UNAVAILABLE')`.
 */
export interface VerificationRepositoryPort {
  findById(context: TransactionContext, id: string): Promise<ContactVerification | null>;
  findForUpdate(context: TransactionContext, id: string): Promise<ContactVerification | null>;
  /** Latest challenge in `open`/`verified` state for the contact, locked. */
  findActiveByContactForUpdate(
    context: TransactionContext,
    contactHash: Buffer,
  ): Promise<ContactVerification | null>;
  insert(context: TransactionContext, verification: ContactVerification): Promise<void>;
  save(context: TransactionContext, verification: ContactVerification): Promise<void>;
}

export interface RegistrationRepositoryPort {
  findInProgressForUpdate(context: TransactionContext, id: string): Promise<Registration | null>;
  findInProgressByContactForUpdate(
    context: TransactionContext,
    contactHash: Buffer,
  ): Promise<Registration | null>;
  insert(context: TransactionContext, registration: Registration): Promise<void>;
  save(context: TransactionContext, registration: Registration): Promise<void>;
  expireStale(context: TransactionContext, now: Date, batch: number): Promise<number>;
}

export interface NewIncompleteAccount {
  readonly account: Account;
  readonly channel: ContactChannel;
  readonly retained: RetainedRegistrationData;
}

export interface AccountRepositoryPort {
  findHoldingContactForUpdate(
    context: TransactionContext,
    channel: ContactChannel,
    contactHash: Buffer,
  ): Promise<Account | null>;
  findForUpdate(context: TransactionContext, id: string): Promise<Account | null>;
  insertIncomplete(context: TransactionContext, input: NewIncompleteAccount): Promise<void>;
  /** Conditional on `account_incomplete`; returns false when another transaction won. */
  activate(context: TransactionContext, account: Account): Promise<boolean>;
  /** Persists the expired state and releases contact and credential (ADR-017). */
  expire(context: TransactionContext, account: Account): Promise<void>;
  /** Expires incomplete accounts not updated since `staleBefore`; returns their ids. */
  expireStale(
    context: TransactionContext,
    staleBefore: Date,
    now: Date,
    batch: number,
  ): Promise<string[]>;
}

export type RateLimitScope = 'contact' | 'origin';
export type RateLimitKind = 'challenge' | 'resend';

export interface RateLimitRepositoryPort {
  /** Atomically consumes one unit; false when the window already reached `limit` (ADR-015). */
  tryConsume(
    context: TransactionContext,
    scope: RateLimitScope,
    subjectHash: Buffer,
    windowStart: Date,
    kind: RateLimitKind,
    limit: number,
  ): Promise<boolean>;
}

export interface ApprovedTermsDocument {
  readonly id: string;
  readonly kind: TermsDocumentKind;
}

export interface TermsAcceptance {
  readonly id: string;
  readonly documentId: string;
}

export interface TermsRepositoryPort {
  findApproved(context: TransactionContext, documentIds: string[]): Promise<ApprovedTermsDocument[]>;
  recordAcceptances(
    context: TransactionContext,
    accountId: string,
    acceptances: TermsAcceptance[],
    acceptedAt: Date,
  ): Promise<void>;
}
