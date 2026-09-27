import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { ProfileWriterPort } from '../../../profiles/domain/ports/profile-writer.port';
import { Account } from '../../domain/entities/account';
import { RegistrationError } from '../../domain/errors/registration.error';
import type {
  AccountRepositoryPort,
  RegistrationRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import { DisplayName, Region, UsageIntent } from '../../domain/value-objects/profile-fields';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';
import type { TransactionHook } from '../contracts/transaction-hook';

export interface SaveRequiredDataInput {
  readonly registrationId: string;
  readonly displayName: string;
  readonly region: string;
  readonly usageIntents: readonly string[];
}

export interface SaveRequiredDataResult {
  readonly accountId: string;
  /** Incomplete accounts are removed after 15 days without update (ADR-008). */
  readonly expiresAt: Date;
}

export class SaveRequiredData {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly registrations: RegistrationRepositoryPort,
    private readonly accounts: AccountRepositoryPort,
    private readonly profiles: ProfileWriterPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  /**
   * RF004 required data (display name, region, usage intent): creates the incomplete account, its
   * contact, credential and profile, closing the registration. The birth date belongs to activation.
   */
  async execute(
    input: SaveRequiredDataInput,
    withinTransaction?: TransactionHook<SaveRequiredDataResult>,
  ): Promise<SaveRequiredDataResult> {
    const displayName = DisplayName.create(input.displayName);
    const region = Region.create(input.region);
    const usageIntents = UsageIntent.createSelection(input.usageIntents);

    const outcome = await this.uow.execute(async (context) => {
      const now = this.clock.now();
      const registration = await this.registrations.findInProgressForUpdate(context, input.registrationId);
      if (!registration) return { kind: 'unavailable' as const };
      if (registration.isExpired(now)) {
        // Committed on purpose: the overdue registration releases its contact (ADR-017).
        await this.registrations.save(context, registration.expire(now));
        return { kind: 'expired' as const };
      }

      const retained = registration.retainedDataAt(now);
      const account = Account.createIncomplete(
        { id: this.ids.next(), registrationId: registration.id },
        now,
      );
      await this.accounts.insertIncomplete(context, { account, channel: registration.channel, retained });
      await this.profiles.upsertRequired(context, account.id, {
        displayName: displayName.value,
        region: region.value,
      });
      await this.profiles.replaceUsageIntents(
        context,
        account.id,
        usageIntents.map((intent) => intent.value),
      );
      await this.registrations.save(context, registration.convert(now));
      const expiresAt = new Date(now.getTime() + this.policy.incompleteAccountTtlMs);
      await withinTransaction?.(context, { accountId: account.id, expiresAt });
      return { kind: 'saved' as const, accountId: account.id, channel: registration.channel, expiresAt };
    });

    this.telemetry.record({
      name: 'registration.required_data_saved',
      outcome: outcome.kind,
      registrationId: input.registrationId,
      accountId: outcome.kind === 'saved' ? outcome.accountId : undefined,
      channel: outcome.kind === 'saved' ? outcome.channel : undefined,
    });
    if (outcome.kind !== 'saved') throw new RegistrationError('REGISTRATION_UNAVAILABLE');
    return { accountId: outcome.accountId, expiresAt: outcome.expiresAt };
  }
}
