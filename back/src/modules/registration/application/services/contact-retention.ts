import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import type { ProfileWriterPort } from '../../../profiles/domain/ports/profile-writer.port';
import type {
  AccountRepositoryPort,
  RegistrationRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { ContactChannel } from '../../domain/value-objects/contact-identifier';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';

/**
 * Lazy expiration (ADR-017): before checking uniqueness, expires the overdue registration or
 * incomplete account holding the contact, then reports whether the contact is still retained.
 */
export class ContactRetention {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly registrations: RegistrationRepositoryPort,
    private readonly accounts: AccountRepositoryPort,
    private readonly profiles: ProfileWriterPort,
  ) {}

  async isRetained(
    context: TransactionContext,
    channel: ContactChannel,
    contactHash: Buffer,
    now: Date,
  ): Promise<boolean> {
    const registration = await this.registrations.findInProgressByContactForUpdate(context, contactHash);
    if (registration) {
      if (!registration.isExpired(now)) return true;
      await this.registrations.save(context, registration.expire(now));
    }

    const account = await this.accounts.findHoldingContactForUpdate(context, channel, contactHash);
    if (!account) return false;
    if (!account.isStale(now, this.policy)) return true;

    await this.accounts.expire(context, account.expire(now));
    await this.profiles.erasePersonalData(context, [account.id]);
    return false;
  }
}
