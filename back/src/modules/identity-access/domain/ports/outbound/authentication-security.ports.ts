import type { LoginEmail } from '../../value-objects/login-email';

export const PASSWORD_VERIFIER_PORT = Symbol('PASSWORD_VERIFIER_PORT');
export const SESSION_TOKEN_PORT = Symbol('SESSION_TOKEN_PORT');
export const LOGIN_SUBJECT_PORT = Symbol('LOGIN_SUBJECT_PORT');

/** Argon2id verification; always outside any transaction or lock. */
export interface PasswordVerifierPort {
  verify(candidate: string, hash: string): Promise<boolean>;
  /** Same cost against a valid dummy hash, so unknown contacts cost like real ones (ADR-035). */
  verifyDummy(candidate: string): Promise<void>;
}

export interface IssuedSessionToken {
  /** 32 random bytes in base64url; lives only in memory and the internal response header. */
  readonly token: string;
  readonly digest: Uint8Array;
}

/** HMAC-SHA-256 under the dedicated `AUTH_SESSION_SECRET` (ADR-033). */
export interface SessionTokenPort {
  issue(): IssuedSessionToken;
  digest(token: string): Uint8Array;
}

/** Keyed digests of the login e-mail: registration's blind index and the rate-limit subject. */
export interface LoginSubjectPort {
  emailHash(email: LoginEmail): Uint8Array;
  /** Separate HMAC domain used only by the login contact bucket. */
  contactRateSubject(email: LoginEmail): Uint8Array;
  /** Subject for inputs that cannot be normalized, so they still consume a bucket. */
  unnormalizedRateSubject(raw: string): Uint8Array;
}
