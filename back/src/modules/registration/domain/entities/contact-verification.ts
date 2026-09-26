import type { ContactChannel } from '../value-objects/contact-identifier';
import type { VerificationPolicy } from '../value-objects/verification-policy';
import { RegistrationError } from '../errors/registration.error';

export class ContactVerification {
  constructor(readonly id: string, readonly channel: ContactChannel, readonly contactHash: Buffer, readonly ciphertext: Buffer, readonly keyVersion: number, readonly otpDigest: Buffer, readonly expiresAt: Date, readonly deliveryIdempotencyKey: string, readonly lastSentAt: Date, readonly status: 'open'|'verified'|'consumed'|'expired' = 'open', readonly failedAttempts = 0, readonly resendCount = 0, readonly lockedUntil: Date | null = null) {}
  isExpired(now: Date) { return this.expiresAt <= now; }
  verify(matches: boolean, now: Date, policy: VerificationPolicy): ContactVerification {
    if (this.status !== 'open' || this.isExpired(now)) throw new RegistrationError('VERIFICATION_UNAVAILABLE');
    if (this.lockedUntil && this.lockedUntil > now) throw new RegistrationError('VERIFICATION_UNAVAILABLE');
    if (matches) return new ContactVerification(this.id,this.channel,this.contactHash,this.ciphertext,this.keyVersion,this.otpDigest,this.expiresAt,this.deliveryIdempotencyKey,this.lastSentAt,'verified',this.failedAttempts,this.resendCount,null);
    const attempts=this.failedAttempts+1; return new ContactVerification(this.id,this.channel,this.contactHash,this.ciphertext,this.keyVersion,this.otpDigest,this.expiresAt,this.deliveryIdempotencyKey,this.lastSentAt,'open',attempts,this.resendCount,attempts>=policy.maxAttempts?new Date(now.getTime()+policy.lockMs):null);
  }
  consume(now: Date): ContactVerification {
    if (this.status !== 'verified') throw new RegistrationError('VERIFICATION_UNAVAILABLE');
    return new ContactVerification(this.id,this.channel,this.contactHash,this.ciphertext,this.keyVersion,this.otpDigest,this.expiresAt,this.deliveryIdempotencyKey,now,'consumed',this.failedAttempts,this.resendCount,null);
  }
  resend(now: Date, policy: VerificationPolicy): ContactVerification {
    if (this.status !== 'open' || this.isExpired(now) || this.resendCount >= policy.maxResends || now.getTime() - this.lastSentAt.getTime() < policy.resendIntervalMs) throw new RegistrationError('VERIFICATION_UNAVAILABLE');
    return new ContactVerification(this.id,this.channel,this.contactHash,this.ciphertext,this.keyVersion,this.otpDigest,this.expiresAt,this.deliveryIdempotencyKey,now,'open',this.failedAttempts,this.resendCount + 1,this.lockedUntil);
  }
}
