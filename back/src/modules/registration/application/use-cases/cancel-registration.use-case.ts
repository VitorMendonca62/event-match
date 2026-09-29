import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { ProfileWriterPort } from '../../../profiles/domain/ports/profile-writer.port';
import { RegistrationError } from '../../domain/errors/registration.error';
import type {
  RegistrationFlowSessionRepositoryPort,
  RegistrationFlowTokenPort,
} from '../../domain/ports/outbound/flow.ports';
import type {
  AccountRepositoryPort,
  RegistrationRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort } from '../../domain/ports/outbound/runtime.ports';

/**
 * The person gives up (ADR-030). It runs the same expiration as an abandoned registration
 * (ADR-017): retained contact and password hash are nulled, a still-incomplete account expires and
 * its personal data is erased, and the continuation is revoked. Nothing is physically deleted.
 * Active accounts and completed sessions are never touched.
 */
export class CancelRegistration {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly sessions: RegistrationFlowSessionRepositoryPort,
    private readonly tokens: RegistrationFlowTokenPort,
    private readonly registrations: RegistrationRepositoryPort,
    private readonly accounts: AccountRepositoryPort,
    private readonly profiles: ProfileWriterPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  async execute(token: string): Promise<void> {
    const digest = this.tokens.digest(token);
    const outcome = await this.uow.execute(async (context) => {
      const now = this.clock.now();
      const session = await this.sessions.findByTokenForUpdate(context, digest, now);
      // A previous token is only for idempotent replays; it cannot cancel.
      if (!session || session.match(digest, now) !== 'current') throw new RegistrationError('FLOW_UNAUTHORIZED');

      if (session.registrationId && session.stage === 'registration_in_progress') {
        const registration = await this.registrations.findInProgressForUpdate(context, session.registrationId);
        if (registration) await this.registrations.save(context, registration.expire(now));
      }
      if (session.accountId && session.stage === 'account_incomplete') {
        const account = await this.accounts.findForUpdate(context, session.accountId);
        if (account?.status === 'account_incomplete') {
          await this.accounts.expire(context, account.expire(now));
          await this.profiles.erasePersonalData(context, [account.id]);
        }
      }
      await this.sessions.save(context, session.cancel(now));
      return { flowSessionId: session.id, stage: session.stage };
    });

    this.telemetry.record({
      name: 'registration.cancelled',
      outcome: outcome.stage,
      flowSessionId: outcome.flowSessionId,
    });
  }
}
