export const AUTHENTICATION_TELEMETRY_PORT = Symbol('AUTHENTICATION_TELEMETRY_PORT');

export type AuthenticationEventName = 'login' | 'session' | 'session.rotated' | 'logout';

export type AuthenticationOutcome =
  | 'success'
  | 'rejected'
  | 'rate_limited'
  | 'expired'
  | 'revoked'
  | 'denied'
  | 'evicted';

/**
 * Aggregated, PII-free event (ADR-035): never e-mail, fingerprint, password, hashes, tokens,
 * cookies, bodies or the private reason of a refusal. The correlation id is random.
 */
export interface AuthenticationEvent {
  readonly name: AuthenticationEventName;
  readonly outcome: AuthenticationOutcome;
  readonly correlationId: string;
  readonly durationMs?: number;
  /** Only when a login bucket fired. */
  readonly scope?: 'contact' | 'origin';
  readonly count?: number;
}

export interface AuthenticationTelemetryPort {
  record(event: AuthenticationEvent): void;
}
