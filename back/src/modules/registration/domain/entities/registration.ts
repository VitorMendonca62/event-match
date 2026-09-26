import { RegistrationError } from '../errors/registration.error';
import type { ContactChannel } from '../value-objects/contact-identifier';
import type { RegistrationPolicy } from '../value-objects/verification-policy';

export type RegistrationStatus = 'registration_in_progress' | 'converted' | 'expired';

/** Contact and credential retained while the registration is in progress. */
export interface RetainedRegistrationData {
  readonly contactHash: Buffer;
  readonly contactCiphertext: Buffer;
  readonly keyVersion: number;
  readonly passwordHash: string;
}

export interface RegistrationProps {
  readonly id: string;
  readonly verificationId: string;
  readonly channel: ContactChannel;
  readonly status: RegistrationStatus;
  readonly retained: RetainedRegistrationData | null;
  readonly lastUpdatedAt: Date;
  readonly expiresAt: Date;
  readonly expiredAt: Date | null;
}

export interface StartRegistrationInput {
  readonly id: string;
  readonly verificationId: string;
  readonly channel: ContactChannel;
  readonly retained: RetainedRegistrationData;
}

/** Born after the contact is verified and a password is chosen (ADR-008). */
export class Registration implements RegistrationProps {
  readonly id: string;
  readonly verificationId: string;
  readonly channel: ContactChannel;
  readonly status: RegistrationStatus;
  readonly retained: RetainedRegistrationData | null;
  readonly lastUpdatedAt: Date;
  readonly expiresAt: Date;
  readonly expiredAt: Date | null;

  private constructor(props: RegistrationProps) {
    this.id = props.id;
    this.verificationId = props.verificationId;
    this.channel = props.channel;
    this.status = props.status;
    this.retained = props.retained;
    this.lastUpdatedAt = props.lastUpdatedAt;
    this.expiresAt = props.expiresAt;
    this.expiredAt = props.expiredAt;
  }

  static start(input: StartRegistrationInput, now: Date, policy: RegistrationPolicy): Registration {
    return new Registration({
      ...input,
      status: 'registration_in_progress',
      lastUpdatedAt: now,
      expiresAt: new Date(now.getTime() + policy.registrationTtlMs),
      expiredAt: null,
    });
  }

  static restore(props: RegistrationProps): Registration {
    if ((props.status === 'registration_in_progress') !== (props.retained !== null)) {
      throw new Error('Inconsistent registration state.');
    }
    return new Registration(props);
  }

  isExpired(now: Date): boolean {
    return this.expiresAt <= now;
  }

  /** Returns retained data, refusing registrations that are closed or past their 24 h window. */
  retainedDataAt(now: Date): RetainedRegistrationData {
    if (this.status !== 'registration_in_progress' || !this.retained || this.isExpired(now)) {
      throw new RegistrationError('REGISTRATION_UNAVAILABLE');
    }
    return this.retained;
  }

  /** Abandonment (ADR-017): sensitive data is nulled immediately, the row stays as a tombstone. */
  expire(now: Date): Registration {
    return this.close('expired', now, now);
  }

  /** Terminal success (ADR-018): data now belongs to the account. */
  convert(now: Date): Registration {
    return this.close('converted', now, null);
  }

  private close(status: RegistrationStatus, now: Date, expiredAt: Date | null): Registration {
    if (this.status !== 'registration_in_progress') {
      throw new RegistrationError('REGISTRATION_UNAVAILABLE');
    }
    return new Registration({ ...this, status, retained: null, lastUpdatedAt: now, expiredAt });
  }
}
