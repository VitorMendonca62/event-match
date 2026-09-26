import { RegistrationError } from '../errors/registration.error';
import type { BirthDate } from '../value-objects/birth-date';
import type { RegistrationPolicy } from '../value-objects/verification-policy';

export type AccountStatus = 'account_incomplete' | 'active' | 'expired';

export interface AccountProps {
  readonly id: string;
  readonly registrationId: string;
  readonly status: AccountStatus;
  readonly birthDate: BirthDate | null;
  readonly lastUpdatedAt: Date;
  readonly activatedAt: Date | null;
  readonly expiredAt: Date | null;
}

export class Account implements AccountProps {
  readonly id: string;
  readonly registrationId: string;
  readonly status: AccountStatus;
  readonly birthDate: BirthDate | null;
  readonly lastUpdatedAt: Date;
  readonly activatedAt: Date | null;
  readonly expiredAt: Date | null;

  private constructor(props: AccountProps) {
    this.id = props.id;
    this.registrationId = props.registrationId;
    this.status = props.status;
    this.birthDate = props.birthDate;
    this.lastUpdatedAt = props.lastUpdatedAt;
    this.activatedAt = props.activatedAt;
    this.expiredAt = props.expiredAt;
  }

  /** RF004 data only; the birth date arrives with the acceptances, at activation. */
  static createIncomplete(input: { id: string; registrationId: string }, now: Date): Account {
    return new Account({
      ...input,
      status: 'account_incomplete',
      birthDate: null,
      lastUpdatedAt: now,
      activatedAt: null,
      expiredAt: null,
    });
  }

  static restore(props: AccountProps): Account {
    return new Account(props);
  }

  /** An incomplete account is removed after 15 days without update (ADR-008). */
  isStale(now: Date, policy: RegistrationPolicy): boolean {
    return (
      this.status === 'account_incomplete' &&
      this.lastUpdatedAt.getTime() + policy.incompleteAccountTtlMs <= now.getTime()
    );
  }

  /** A minor's birth date is refused without ever being persisted (RF001, RN001). */
  activate(birthDate: BirthDate, now: Date, policy: RegistrationPolicy): Account {
    if (
      this.status !== 'account_incomplete' ||
      this.isStale(now, policy) ||
      !birthDate.isAdultAt(now)
    ) {
      throw new RegistrationError('ACCOUNT_CANNOT_BE_ACTIVATED');
    }
    return new Account({ ...this, status: 'active', birthDate, lastUpdatedAt: now, activatedAt: now });
  }

  expire(now: Date): Account {
    if (this.status !== 'account_incomplete') {
      throw new RegistrationError('ACCOUNT_CANNOT_BE_ACTIVATED');
    }
    return new Account({
      ...this,
      status: 'expired',
      birthDate: null,
      lastUpdatedAt: now,
      expiredAt: now,
    });
  }
}
