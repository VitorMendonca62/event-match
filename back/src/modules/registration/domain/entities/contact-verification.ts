import { RegistrationError } from '../errors/registration.error';
import type { ContactChannel } from '../value-objects/contact-identifier';
import type { RegistrationPolicy } from '../value-objects/verification-policy';

export type ContactVerificationStatus = 'open' | 'verified' | 'consumed' | 'expired';

export interface ContactVerificationProps {
  readonly id: string;
  readonly channel: ContactChannel;
  readonly contactHash: Buffer;
  readonly contactCiphertext: Buffer;
  readonly keyVersion: number;
  readonly otpDigest: Buffer;
  readonly expiresAt: Date;
  readonly deliveryIdempotencyKey: string;
  readonly lastSentAt: Date;
  readonly whatsappConsentAt: Date | null;
  readonly status: ContactVerificationStatus;
  readonly failedAttempts: number;
  readonly resendCount: number;
  readonly lockedUntil: Date | null;
  readonly consumedAt: Date | null;
}

export interface IssueContactVerificationInput {
  readonly id: string;
  readonly channel: ContactChannel;
  readonly contactHash: Buffer;
  readonly contactCiphertext: Buffer;
  readonly keyVersion: number;
  readonly otpDigest: Buffer;
  readonly deliveryIdempotencyKey: string;
  readonly whatsappConsentAt: Date | null;
}

/** OTP challenge for one contact (ADR-009): stores only digests and counters. */
export class ContactVerification implements ContactVerificationProps {
  readonly id: string;
  readonly channel: ContactChannel;
  readonly contactHash: Buffer;
  readonly contactCiphertext: Buffer;
  readonly keyVersion: number;
  readonly otpDigest: Buffer;
  readonly expiresAt: Date;
  readonly deliveryIdempotencyKey: string;
  readonly lastSentAt: Date;
  readonly whatsappConsentAt: Date | null;
  readonly status: ContactVerificationStatus;
  readonly failedAttempts: number;
  readonly resendCount: number;
  readonly lockedUntil: Date | null;
  readonly consumedAt: Date | null;

  private constructor(props: ContactVerificationProps) {
    this.id = props.id;
    this.channel = props.channel;
    this.contactHash = props.contactHash;
    this.contactCiphertext = props.contactCiphertext;
    this.keyVersion = props.keyVersion;
    this.otpDigest = props.otpDigest;
    this.expiresAt = props.expiresAt;
    this.deliveryIdempotencyKey = props.deliveryIdempotencyKey;
    this.lastSentAt = props.lastSentAt;
    this.whatsappConsentAt = props.whatsappConsentAt;
    this.status = props.status;
    this.failedAttempts = props.failedAttempts;
    this.resendCount = props.resendCount;
    this.lockedUntil = props.lockedUntil;
    this.consumedAt = props.consumedAt;
  }

  static issue(
    input: IssueContactVerificationInput,
    now: Date,
    policy: RegistrationPolicy,
  ): ContactVerification {
    if (input.channel === 'whatsapp' && !input.whatsappConsentAt) {
      throw new RegistrationError('WHATSAPP_CONSENT_REQUIRED');
    }
    return new ContactVerification({
      ...input,
      expiresAt: new Date(now.getTime() + policy.otpTtlMs),
      lastSentAt: now,
      status: 'open',
      failedAttempts: 0,
      resendCount: 0,
      lockedUntil: null,
      consumedAt: null,
    });
  }

  static restore(props: ContactVerificationProps): ContactVerification {
    return new ContactVerification(props);
  }

  isExpired(now: Date): boolean {
    return this.expiresAt <= now;
  }

  isLocked(now: Date): boolean {
    return this.lockedUntil !== null && this.lockedUntil > now;
  }

  /** Records one attempt; a wrong code after the fifth failure is refused without counting. */
  verify(codeMatches: boolean, now: Date, policy: RegistrationPolicy): ContactVerification {
    this.assertOpen(now, policy);

    if (codeMatches) return this.with({ status: 'verified', lockedUntil: null });

    const failedAttempts = this.failedAttempts + 1;
    return this.with({
      failedAttempts,
      lockedUntil:
        failedAttempts >= policy.maxAttempts ? new Date(now.getTime() + policy.lockMs) : null,
    });
  }

  /** Rotates the code: only its digest is stored, so a resend always issues a new OTP. */
  resend(otpDigest: Buffer, now: Date, policy: RegistrationPolicy): ContactVerification {
    this.assertOpen(now, policy);
    if (
      this.resendCount >= policy.maxResendsPerChallenge ||
      now.getTime() - this.lastSentAt.getTime() < policy.resendIntervalMs
    ) {
      throw new RegistrationError('VERIFICATION_UNAVAILABLE');
    }
    return this.with({
      otpDigest,
      expiresAt: new Date(now.getTime() + policy.otpTtlMs),
      lastSentAt: now,
      resendCount: this.resendCount + 1,
    });
  }

  consume(now: Date): ContactVerification {
    if (this.status !== 'verified' || this.consumedAt !== null || this.isExpired(now)) {
      throw new RegistrationError('VERIFICATION_UNAVAILABLE');
    }
    return this.with({ status: 'consumed', consumedAt: now });
  }

  /** A new request for the same contact replaces an unlocked open challenge. */
  supersede(): ContactVerification {
    return this.with({ status: 'expired' });
  }

  private assertOpen(now: Date, policy: RegistrationPolicy): void {
    if (
      this.status !== 'open' ||
      this.isExpired(now) ||
      this.isLocked(now) ||
      this.failedAttempts >= policy.maxAttempts
    ) {
      throw new RegistrationError('VERIFICATION_UNAVAILABLE');
    }
  }

  private with(changes: Partial<ContactVerificationProps>): ContactVerification {
    return new ContactVerification({ ...this, ...changes });
  }
}
