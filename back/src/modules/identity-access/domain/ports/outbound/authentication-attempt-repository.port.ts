import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';

export const AUTHENTICATION_ATTEMPT_REPOSITORY_PORT = Symbol('AUTHENTICATION_ATTEMPT_REPOSITORY_PORT');

export interface LoginAttemptReservationInput {
  /** HMAC of the normalized contact in the login domain; never the contact. */
  readonly contactSubject: Uint8Array;
  /** Origin fingerprint authenticated by the BFF (ADR-023); never an IP. */
  readonly originSubject: Uint8Array;
  readonly now: Date;
  readonly windowMs: number;
  readonly contactLimit: number;
  readonly originLimit: number;
}

export type LoginAttemptReservation =
  | { readonly outcome: 'allowed'; readonly reservationIds: readonly string[] }
  | { readonly outcome: 'contact_limited' | 'origin_limited' };

/**
 * Sliding-window buckets per contact and per origin (ADR-035). `reserve` serializes each subject,
 * drops attempts older than the window, counts and records one attempt in both buckets atomically.
 * A successful login releases its own reservation, so only failures consume the limits.
 */
export interface AuthenticationAttemptRepositoryPort {
  reserve(context: TransactionContext, input: LoginAttemptReservationInput): Promise<LoginAttemptReservation>;
  release(context: TransactionContext, reservationIds: readonly string[]): Promise<void>;
}
