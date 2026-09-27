import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import { RegistrationFlowSession } from '../../domain/entities/registration-flow-session';
import type {
  RegistrationFlowSessionRepositoryPort,
  RegistrationFlowTokenPort,
} from '../../domain/ports/outbound/flow.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import { BirthDate } from '../../domain/value-objects/birth-date';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';

export type RegistrationEligibilityResult =
  | { readonly eligible: false }
  | { readonly eligible: true; readonly continuation: string; readonly expiresAt: Date };

/**
 * First step of the journey (RF001, RN001, ADR-019): an adult receives an `age_eligible`
 * continuation; a minor receives nothing and no row is written. The birth date is used only in
 * memory and never reaches the session, logs or telemetry.
 */
export class CheckRegistrationEligibility {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly sessions: RegistrationFlowSessionRepositoryPort,
    private readonly tokens: RegistrationFlowTokenPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  async execute(input: { birthDate: string }): Promise<RegistrationEligibilityResult> {
    const birthDate = BirthDate.create(input.birthDate);
    const now = this.clock.now();
    if (!birthDate.isAdultAt(now)) {
      this.telemetry.record({ name: 'registration.eligibility', outcome: 'ineligible' });
      return { eligible: false };
    }

    const token = this.tokens.generate();
    const session = RegistrationFlowSession.issueEligible(
      { id: this.ids.next(), tokenDigest: token.digest },
      now,
      this.policy,
    );
    await this.uow.execute((context) => this.sessions.insert(context, session));
    this.telemetry.record({ name: 'registration.eligibility', outcome: 'eligible', flowSessionId: session.id });
    return { eligible: true, continuation: token.plain, expiresAt: session.expiresAt };
  }
}
