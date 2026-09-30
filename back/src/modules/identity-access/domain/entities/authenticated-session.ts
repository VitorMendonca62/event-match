import { lifetimeOf, type SessionMode, type SessionPolicy } from '../services/session-policy';

export interface AuthenticatedSessionProps {
  readonly id: string;
  readonly accountId: string;
  /** HMAC of the current opaque token; the token itself is never stored (ADR-033). */
  readonly tokenDigest: Uint8Array;
  readonly previousTokenDigest: Uint8Array | null;
  readonly previousValidUntil: Date | null;
  readonly remembered: boolean;
  readonly idleTimeoutSeconds: number;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly rotatedAt: Date;
  readonly absoluteExpiresAt: Date;
}

export type SessionExpiry = 'absolute' | 'idle';

/**
 * Common session of an `active` account (ADR-033). It stores identity and deadlines only, never
 * status or permissions (ADR-036). Deadlines are exclusive: at the exact instant the session is
 * already expired.
 */
export class AuthenticatedSession implements AuthenticatedSessionProps {
  readonly id: string;
  readonly accountId: string;
  readonly tokenDigest: Uint8Array;
  readonly previousTokenDigest: Uint8Array | null;
  readonly previousValidUntil: Date | null;
  readonly remembered: boolean;
  readonly idleTimeoutSeconds: number;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly rotatedAt: Date;
  readonly absoluteExpiresAt: Date;

  private constructor(props: AuthenticatedSessionProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.tokenDigest = props.tokenDigest;
    this.previousTokenDigest = props.previousTokenDigest;
    this.previousValidUntil = props.previousValidUntil;
    this.remembered = props.remembered;
    this.idleTimeoutSeconds = props.idleTimeoutSeconds;
    this.createdAt = props.createdAt;
    this.lastSeenAt = props.lastSeenAt;
    this.rotatedAt = props.rotatedAt;
    this.absoluteExpiresAt = props.absoluteExpiresAt;
  }

  /** Login always issues a fresh secret: no pre-authentication identifier is ever accepted. */
  static start(
    input: { id: string; accountId: string; tokenDigest: Uint8Array; mode: SessionMode },
    now: Date,
    policy: SessionPolicy,
  ): AuthenticatedSession {
    const lifetime = lifetimeOf(policy, input.mode);
    return new AuthenticatedSession({
      id: input.id,
      accountId: input.accountId,
      tokenDigest: input.tokenDigest,
      previousTokenDigest: null,
      previousValidUntil: null,
      remembered: input.mode === 'remembered',
      idleTimeoutSeconds: Math.floor(lifetime.idleTtlMs / 1000),
      createdAt: now,
      lastSeenAt: now,
      rotatedAt: now,
      absoluteExpiresAt: new Date(now.getTime() + lifetime.absoluteTtlMs),
    });
  }

  static restore(props: AuthenticatedSessionProps): AuthenticatedSession {
    return new AuthenticatedSession(props);
  }

  get mode(): SessionMode {
    return this.remembered ? 'remembered' : 'browser';
  }

  /** Inactivity deadline, never beyond the absolute one: activity cannot extend the session. */
  get idleExpiresAt(): Date {
    const idle = this.lastSeenAt.getTime() + this.idleTimeoutSeconds * 1000;
    return new Date(Math.min(idle, this.absoluteExpiresAt.getTime()));
  }

  expiry(now: Date): SessionExpiry | null {
    if (now.getTime() >= this.absoluteExpiresAt.getTime()) return 'absolute';
    if (now.getTime() >= this.idleExpiresAt.getTime()) return 'idle';
    return null;
  }

  /** The previous digest only finishes requests already in flight when the rotation happened. */
  acceptsPrevious(now: Date): boolean {
    return this.previousValidUntil !== null && now.getTime() < this.previousValidUntil.getTime();
  }

  /** Amortized activity: `last_seen_at` moves at most once per write interval. */
  activityWriteDue(now: Date, policy: SessionPolicy): boolean {
    return now.getTime() - this.lastSeenAt.getTime() >= policy.activityWriteIntervalMs;
  }

  touch(now: Date): AuthenticatedSession {
    return new AuthenticatedSession({ ...this, lastSeenAt: now });
  }

  /** Only remembered sessions rotate periodically; 12-hour sessions never do (ADR-033). */
  rotationDue(now: Date, policy: SessionPolicy): boolean {
    return this.remembered && now.getTime() - this.rotatedAt.getTime() >= policy.renewalIntervalMs;
  }

  /**
   * Swaps the current digest and keeps the previous one for the grace period. Rotation alone
   * never updates activity nor extends any deadline.
   */
  rotate(newTokenDigest: Uint8Array, now: Date, policy: SessionPolicy): AuthenticatedSession {
    return new AuthenticatedSession({
      ...this,
      tokenDigest: newTokenDigest,
      previousTokenDigest: this.tokenDigest,
      previousValidUntil: new Date(now.getTime() + policy.previousTokenGraceMs),
      rotatedAt: now,
    });
  }
}
