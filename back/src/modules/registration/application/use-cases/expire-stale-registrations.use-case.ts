import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { ProfileWriterPort } from '../../../profiles/domain/ports/profile-writer.port';
import type {
  AccountRepositoryPort,
  RegistrationRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationFlowSessionRepositoryPort } from '../../domain/ports/outbound/flow.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort } from '../../domain/ports/outbound/runtime.ports';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';

export interface ExpireStaleRegistrationsResult {
  readonly registrations: number;
  readonly accounts: number;
  readonly sessions: number;
}

/**
 * Batch expiration without physical deletion; intentionally not scheduled (ADR-017). Expired
 * continuation sessions lose their token digests (ADR-021).
 */
export class ExpireStaleRegistrations {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly registrations: RegistrationRepositoryPort,
    private readonly accounts: AccountRepositoryPort,
    private readonly profiles: ProfileWriterPort,
    private readonly sessions: RegistrationFlowSessionRepositoryPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  async execute(batch = 100): Promise<ExpireStaleRegistrationsResult> {
    const result = await this.uow.execute(async (context) => {
      const now = this.clock.now();
      const staleBefore = new Date(now.getTime() - this.policy.incompleteAccountTtlMs);
      const registrations = await this.registrations.expireStale(context, now, batch);
      const accountIds = await this.accounts.expireStale(context, staleBefore, now, batch);
      await this.profiles.erasePersonalData(context, accountIds);
      const sessions = await this.sessions.expireStale(context, now, batch);
      return { registrations, accounts: accountIds.length, sessions };
    });

    this.telemetry.record({ name: 'registration.stale_expired', outcome: 'registrations', count: result.registrations });
    this.telemetry.record({ name: 'registration.stale_expired', outcome: 'accounts', count: result.accounts });
    this.telemetry.record({ name: 'registration.stale_expired', outcome: 'sessions', count: result.sessions });
    return result;
  }
}
