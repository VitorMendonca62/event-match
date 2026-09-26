import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { RegistrationFlowSession } from '../../entities/registration-flow-session';
import type { GeneratedSecret } from './security.ports';

export const REGISTRATION_FLOW_SESSION_REPOSITORY_PORT = Symbol('REGISTRATION_FLOW_SESSION_REPOSITORY_PORT');
export const REGISTRATION_IDEMPOTENCY_REPOSITORY_PORT = Symbol('REGISTRATION_IDEMPOTENCY_REPOSITORY_PORT');
export const REGISTRATION_FLOW_TOKEN_PORT = Symbol('REGISTRATION_FLOW_TOKEN_PORT');

/** Continuation sessions (ADR-021); every lookup is by digest, never by a caller-supplied id. */
export interface RegistrationFlowSessionRepositoryPort {
  insert(context: TransactionContext, session: RegistrationFlowSession): Promise<void>;
  /** Active session whose current or in-grace previous digest matches, locked. */
  findByTokenForUpdate(
    context: TransactionContext,
    tokenDigest: Buffer,
    now: Date,
  ): Promise<RegistrationFlowSession | null>;
  findByIdForUpdate(context: TransactionContext, id: string): Promise<RegistrationFlowSession | null>;
  /** Active `verification_pending` session bound to the challenge, locked (e-mail link). */
  findPendingByVerificationForUpdate(
    context: TransactionContext,
    verificationId: string,
    now: Date,
  ): Promise<RegistrationFlowSession | null>;
  save(context: TransactionContext, session: RegistrationFlowSession): Promise<void>;
  /** Nulls the digests of expired sessions without deleting them; returns how many. */
  expireStale(context: TransactionContext, now: Date, batch: number): Promise<number>;
}

export const FLOW_OPERATIONS = [
  'contact_request',
  'contact_resend',
  'contact_confirm',
  'password',
  'required_data',
  'complete',
] as const;

export type FlowOperation = (typeof FLOW_OPERATIONS)[number];

/** Public, secret-free result of a successful command; `rotates` asks a replay for a new token. */
export interface StoredOutcome {
  readonly body: Readonly<Record<string, unknown>>;
  readonly rotates: boolean;
}

export interface IdempotencyRecord {
  readonly id: string;
  readonly flowSessionId: string;
  readonly operation: FlowOperation;
  readonly requestHash: Buffer;
  /** Null while the command is running (reservation). */
  readonly outcome: StoredOutcome | null;
  readonly expiresAt: Date;
}

export interface NewIdempotencyReservation {
  readonly id: string;
  readonly flowSessionId: string;
  readonly operation: FlowOperation;
  readonly keyHash: Buffer;
  readonly requestHash: Buffer;
  readonly expiresAt: Date;
}

/** Stores only key/payload hashes and safe outcomes (ADR-021). */
export interface RegistrationIdempotencyRepositoryPort {
  findForUpdate(
    context: TransactionContext,
    flowSessionId: string,
    operation: FlowOperation,
    keyHash: Buffer,
  ): Promise<IdempotencyRecord | null>;
  /** Throws `RegistrationError('IDEMPOTENCY_CONFLICT')` when the key is already taken. */
  reserve(context: TransactionContext, reservation: NewIdempotencyReservation): Promise<void>;
  /** Takes over a reservation whose lease expired, e.g. after a crash mid-command. */
  renew(context: TransactionContext, id: string, requestHash: Buffer, expiresAt: Date): Promise<void>;
  complete(context: TransactionContext, id: string, outcome: StoredOutcome, expiresAt: Date): Promise<void>;
  /** Drops an unfinished reservation so the command can be retried after a refusal. */
  release(context: TransactionContext, id: string): Promise<void>;
}

/** Opaque continuation token and keyed fingerprints with `REGISTRATION_FLOW_SECRET`. */
export interface RegistrationFlowTokenPort {
  /** 32 random bytes, base64url, with its digest. */
  generate(): GeneratedSecret;
  digest(token: string): Buffer;
  /** Domain-separated HMAC for idempotency keys and request payloads. */
  fingerprint(purpose: 'idempotency_key' | 'request', value: string): Buffer;
}
