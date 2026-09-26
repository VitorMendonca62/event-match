import type { ContactChannel } from '../value-objects/contact-identifier';

export type RegistrationStatus = 'registration_in_progress' | 'expired';

/** Aggregate retaining verified contact and credential until required profile data is saved. */
export class Registration {
  constructor(
    readonly id: string,
    readonly verificationId: string,
    readonly channel: ContactChannel,
    readonly contactHash: Buffer | null,
    readonly ciphertext: Buffer | null,
    readonly keyVersion: number | null,
    readonly passwordHash: string | null,
    readonly lastUpdatedAt: Date,
    readonly expiresAt: Date,
    readonly status: RegistrationStatus = 'registration_in_progress',
    readonly expiredAt: Date | null = null,
  ) {}

  isExpired(now: Date): boolean { return this.expiresAt <= now; }
  expire(now: Date): Registration {
    return new Registration(this.id, this.verificationId, this.channel, null, null, null, null, now, this.expiresAt, 'expired', now);
  }
}
