import type { BirthDate } from '../value-objects/birth-date';

export type AccountStatus = 'account_incomplete' | 'active' | 'expired';

export class Account {
  constructor(
    readonly id: string,
    readonly registrationId: string,
    readonly status: AccountStatus,
    readonly birthDate: BirthDate | null,
    readonly lastUpdatedAt: Date,
    readonly activatedAt: Date | null = null,
    readonly expiredAt: Date | null = null,
  ) {}

  activate(now: Date): Account {
    if (this.status !== 'account_incomplete' || !this.birthDate?.isAdultAt(now)) {
      throw new Error('ACCOUNT_CANNOT_BE_ACTIVATED');
    }
    return new Account(this.id, this.registrationId, 'active', this.birthDate, now, now);
  }
  expire(now: Date): Account { return new Account(this.id, this.registrationId, 'expired', null, now, null, now); }
}
