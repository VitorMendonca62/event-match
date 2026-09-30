export type SessionMode = 'browser' | 'remembered';

export interface SessionLifetime {
  readonly absoluteTtlMs: number;
  readonly idleTtlMs: number;
}

/**
 * Validated session and login policy (ADR-033, ADR-035). Built once from configuration by the
 * composition root; the domain never reads the environment.
 */
export interface SessionPolicy {
  readonly browser: SessionLifetime;
  readonly remembered: SessionLifetime;
  /** `last_seen_at` is written at most once per interval (amortized activity). */
  readonly activityWriteIntervalMs: number;
  /** Remembered sessions become eligible for transparent rotation after this interval. */
  readonly renewalIntervalMs: number;
  /** The previous digest finishes concurrent requests for at most this long after a rotation. */
  readonly previousTokenGraceMs: number;
  readonly maxSessionsPerAccount: number;
  readonly login: LoginLimits;
}

export interface LoginLimits {
  readonly windowMs: number;
  readonly contactLimit: number;
  readonly originLimit: number;
}

export const SESSION_POLICY = Symbol('SESSION_POLICY');

export function lifetimeOf(policy: SessionPolicy, mode: SessionMode): SessionLifetime {
  return mode === 'remembered' ? policy.remembered : policy.browser;
}
