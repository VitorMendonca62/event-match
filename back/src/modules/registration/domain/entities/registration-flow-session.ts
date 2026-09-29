import { RegistrationError } from '../errors/registration.error';
import type { RegistrationPolicy } from '../value-objects/verification-policy';

export const FLOW_STAGES = [
  'age_eligible',
  'verification_pending',
  'contact_verified',
  'registration_in_progress',
  'account_incomplete',
  'completed',
] as const;

export type FlowStage = (typeof FLOW_STAGES)[number];

export interface RegistrationFlowSessionProps {
  readonly id: string;
  readonly tokenDigest: Buffer | null;
  readonly previousTokenDigest: Buffer | null;
  readonly previousValidUntil: Date | null;
  readonly stage: FlowStage;
  /** Null while `verification_pending` answered neutrally (RNF004): no challenge was issued. */
  readonly verificationId: string | null;
  readonly registrationId: string | null;
  readonly accountId: string | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly updatedAt: Date;
}

export type TokenMatch = 'current' | 'previous';

/**
 * Continuation of the registration journey (ADR-019, ADR-021). It authorizes one stage at a time
 * through an opaque token stored only as a digest; it never holds birth date, contact, OTP or
 * password.
 */
export class RegistrationFlowSession implements RegistrationFlowSessionProps {
  readonly id: string;
  readonly tokenDigest: Buffer | null;
  readonly previousTokenDigest: Buffer | null;
  readonly previousValidUntil: Date | null;
  readonly stage: FlowStage;
  readonly verificationId: string | null;
  readonly registrationId: string | null;
  readonly accountId: string | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly updatedAt: Date;

  private constructor(props: RegistrationFlowSessionProps) {
    this.id = props.id;
    this.tokenDigest = props.tokenDigest;
    this.previousTokenDigest = props.previousTokenDigest;
    this.previousValidUntil = props.previousValidUntil;
    this.stage = props.stage;
    this.verificationId = props.verificationId;
    this.registrationId = props.registrationId;
    this.accountId = props.accountId;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.updatedAt = props.updatedAt;
  }

  /** Issued only after an adult birth date; the date itself is never part of the session. */
  static issueEligible(
    input: { id: string; tokenDigest: Buffer },
    now: Date,
    policy: RegistrationPolicy,
  ): RegistrationFlowSession {
    return new RegistrationFlowSession({
      id: input.id,
      tokenDigest: input.tokenDigest,
      previousTokenDigest: null,
      previousValidUntil: null,
      stage: 'age_eligible',
      verificationId: null,
      registrationId: null,
      accountId: null,
      expiresAt: new Date(now.getTime() + policy.eligibleFlowTtlMs),
      revokedAt: null,
      updatedAt: now,
    });
  }

  static restore(props: RegistrationFlowSessionProps): RegistrationFlowSession {
    return new RegistrationFlowSession(props);
  }

  isActive(now: Date): boolean {
    return this.revokedAt === null && this.tokenDigest !== null && this.expiresAt > now;
  }

  /** The previous token only counts inside its grace window, and only for idempotent replays. */
  match(digest: Buffer, now: Date): TokenMatch | null {
    if (!this.isActive(now)) return null;
    if (this.tokenDigest?.equals(digest)) return 'current';
    if (
      this.previousTokenDigest?.equals(digest) &&
      this.previousValidUntil !== null &&
      this.previousValidUntil > now
    ) {
      return 'previous';
    }
    return null;
  }

  /** A new request may replace a pending one, e.g. after a typo in the e-mail address. */
  awaitVerification(verificationId: string | null, expiresAt: Date, now: Date): RegistrationFlowSession {
    this.assertStage('age_eligible', 'verification_pending');
    return this.with({ stage: 'verification_pending', verificationId, expiresAt, updatedAt: now });
  }

  /** Resends keep the stage; the session follows the challenge window. */
  extendVerification(expiresAt: Date, now: Date): RegistrationFlowSession {
    this.assertStage('verification_pending');
    return this.with({ expiresAt, updatedAt: now });
  }

  confirmContact(expiresAt: Date, now: Date): RegistrationFlowSession {
    this.assertStage('verification_pending');
    if (this.verificationId === null) throw new RegistrationError('FLOW_STAGE_CONFLICT');
    return this.with({ stage: 'contact_verified', expiresAt, updatedAt: now });
  }

  startRegistration(registrationId: string, expiresAt: Date, now: Date): RegistrationFlowSession {
    this.assertStage('contact_verified');
    return this.with({ stage: 'registration_in_progress', registrationId, expiresAt, updatedAt: now });
  }

  createAccount(accountId: string, expiresAt: Date, now: Date): RegistrationFlowSession {
    this.assertStage('registration_in_progress');
    return this.with({ stage: 'account_incomplete', accountId, expiresAt, updatedAt: now });
  }

  /** Terminal: digests are nulled so no token can be replayed after activation. */
  complete(now: Date): RegistrationFlowSession {
    this.assertStage('account_incomplete');
    return this.with({
      stage: 'completed',
      tokenDigest: null,
      previousTokenDigest: null,
      previousValidUntil: null,
      revokedAt: now,
      updatedAt: now,
    });
  }

  /** Terminal cancellation (ADR-030): digests are nulled like on completion, the stage stays as evidence. */
  cancel(now: Date): RegistrationFlowSession {
    if (this.stage === 'completed') throw new RegistrationError('FLOW_STAGE_CONFLICT');
    return this.with({
      tokenDigest: null,
      previousTokenDigest: null,
      previousValidUntil: null,
      revokedAt: now,
      updatedAt: now,
    });
  }

  /** Privilege change: the old token survives briefly, only to replay the same idempotent request. */
  rotate(tokenDigest: Buffer, now: Date, policy: RegistrationPolicy): RegistrationFlowSession {
    if (this.tokenDigest === null) throw new RegistrationError('FLOW_UNAUTHORIZED');
    return this.with({
      tokenDigest,
      previousTokenDigest: this.tokenDigest,
      previousValidUntil: new Date(now.getTime() + policy.previousTokenGraceMs),
      updatedAt: now,
    });
  }

  private assertStage(...stages: FlowStage[]): void {
    if (!stages.includes(this.stage)) throw new RegistrationError('FLOW_STAGE_CONFLICT');
  }

  private with(changes: Partial<RegistrationFlowSessionProps>): RegistrationFlowSession {
    return new RegistrationFlowSession({ ...this, ...changes });
  }
}
