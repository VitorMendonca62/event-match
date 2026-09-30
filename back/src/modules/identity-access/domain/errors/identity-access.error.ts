export type IdentityAccessErrorCode =
  /** Unknown contact, wrong password or an account state without common session: one neutral 401. */
  | 'INVALID_CREDENTIALS'
  /** One of the independent login buckets is exhausted (ADR-035). */
  | 'RATE_LIMITED'
  /** The presented session is past its absolute or idle deadline. */
  | 'SESSION_EXPIRED'
  /** Unknown, logged out, evicted, or its account is no longer `active` (ADR-036). */
  | 'SESSION_REVOKED'
  /** `active` account whose current policy denies the requested capability (ADR-036). */
  | 'CAPABILITY_DENIED';

/** Framework-independent error; the presentation filter maps codes to neutral HTTP answers. */
export class IdentityAccessError extends Error {
  constructor(readonly code: IdentityAccessErrorCode) {
    super(code);
    this.name = 'IdentityAccessError';
  }
}

export function isIdentityAccessError(
  error: unknown,
  code?: IdentityAccessErrorCode,
): error is IdentityAccessError {
  return error instanceof IdentityAccessError && (code === undefined || error.code === code);
}
