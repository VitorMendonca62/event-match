import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { ContactVerification } from '../../domain/entities/contact-verification';
import { isRegistrationError } from '../../domain/errors/registration.error';
import type { VerificationRepositoryPort } from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort } from '../../domain/ports/outbound/runtime.ports';
import type { VerificationSecretPort } from '../../domain/ports/outbound/security.ports';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';

export interface VerifyContactResult {
  readonly verificationId: string;
  readonly verified: boolean;
}

interface Attempt {
  readonly outcome: 'verified' | 'failed' | 'locked' | 'unavailable';
  readonly verificationId?: string;
}

export class VerifyContact {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly verifications: VerificationRepositoryPort,
    private readonly secrets: VerificationSecretPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  /**
   * The challenge row is locked (ADR-016), so concurrent attempts are serialized and at most five
   * failures are counted. Unknown, expired and locked challenges answer `verified: false`.
   */
  async execute(input: { verificationId: string; otp: string }): Promise<VerifyContactResult> {
    const attempt = await this.uow.execute(async (context): Promise<Attempt> => {
      const verification = await this.verifications.findForUpdate(context, input.verificationId);
      if (!verification) return { outcome: 'unavailable' };

      let next: ContactVerification;
      try {
        next = verification.verify(
          this.secrets.matches(input.otp, verification.otpDigest),
          this.clock.now(),
          this.policy,
        );
      } catch (error) {
        if (isRegistrationError(error)) return { outcome: 'unavailable', verificationId: verification.id };
        throw error;
      }
      await this.verifications.save(context, next);
      const outcome = next.status === 'verified' ? 'verified' : next.lockedUntil ? 'locked' : 'failed';
      return { outcome, verificationId: verification.id };
    });

    // Only ids of existing challenges are logged; caller input never reaches telemetry.
    this.telemetry.record({
      name: 'verification.attempted',
      outcome: attempt.outcome,
      verificationId: attempt.verificationId,
    });
    return { verificationId: input.verificationId, verified: attempt.outcome === 'verified' };
  }
}
