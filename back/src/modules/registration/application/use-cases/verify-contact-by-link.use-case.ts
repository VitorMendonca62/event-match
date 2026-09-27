import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import { isRegistrationError } from '../../domain/errors/registration.error';
import type { VerificationRepositoryPort } from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort } from '../../domain/ports/outbound/runtime.ports';
import type { VerificationSecretPort } from '../../domain/ports/outbound/security.ports';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';
import type { TransactionHook } from '../contracts/transaction-hook';

export interface LinkVerification {
  readonly verificationId: string;
  readonly expiresAt: Date;
}

/**
 * Single-use e-mail link (ADR-024): the challenge is found by the link digest under lock and the
 * link is burned on success. Unknown, used, expired or locked links answer `verified: false`, and
 * so does a refusal of the hook, which rolls the verification back.
 */
export class VerifyContactByLink {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly verifications: VerificationRepositoryPort,
    private readonly secrets: VerificationSecretPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  async execute(
    input: { token: string },
    withinTransaction?: TransactionHook<LinkVerification>,
  ): Promise<{ verified: boolean }> {
    const digest = this.secrets.digest(input.token);
    let verificationId: string | undefined;
    let verified = false;
    try {
      verified = await this.uow.execute(async (context) => {
        const verification = await this.verifications.findByLinkDigestForUpdate(context, digest);
        if (!verification) return false;
        verificationId = verification.id;
        const next = verification.verifyByLink(this.clock.now(), this.policy);
        await this.verifications.save(context, next);
        await withinTransaction?.(context, { verificationId: next.id, expiresAt: next.expiresAt });
        return true;
      });
    } catch (error) {
      if (!isRegistrationError(error)) throw error;
    }

    this.telemetry.record({
      name: 'verification.attempted',
      outcome: verified ? 'link_verified' : 'link_unavailable',
      verificationId,
    });
    return { verified };
  }
}
