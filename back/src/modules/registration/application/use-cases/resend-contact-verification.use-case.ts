import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { ContactVerification } from '../../domain/entities/contact-verification';
import { isRegistrationError } from '../../domain/errors/registration.error';
import type {
  RateLimitRepositoryPort,
  VerificationRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort } from '../../domain/ports/outbound/runtime.ports';
import type {
  ContactProtectorPort,
  VerificationSecretPort,
} from '../../domain/ports/outbound/security.ports';
import { REGISTRATION_POLICY, rateWindowStart } from '../../domain/value-objects/verification-policy';
import type { VerificationDispatcher } from '../services/verification-dispatcher';

export interface ResendContactVerificationResult {
  readonly nextResendAt: Date;
}

type Resent = { kind: 'sent'; verificationId: string; verification: ContactVerification; otp: string };
type Refused = { kind: 'unavailable'; verificationId?: undefined } | { kind: 'refused'; verificationId: string };

export class ResendContactVerification {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly verifications: VerificationRepositoryPort,
    private readonly limits: RateLimitRepositoryPort,
    private readonly contacts: ContactProtectorPort,
    private readonly secrets: VerificationSecretPort,
    private readonly clock: ClockPort,
    private readonly dispatcher: VerificationDispatcher,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  /** Always answers with the same shape; unknown, locked or throttled challenges are not revealed. */
  async execute(input: { verificationId: string }): Promise<ResendContactVerificationResult> {
    const now = this.clock.now();
    const result = { nextResendAt: new Date(now.getTime() + this.policy.resendIntervalMs) };

    // ADR-015: count against the contact that owns the challenge, never a caller-supplied subject.
    const throttle = await this.uow.execute(async (context): Promise<Refused | null> => {
      const verification = await this.verifications.findById(context, input.verificationId);
      if (!verification) return { kind: 'unavailable' };
      const contact = this.contacts.open(verification.channel, {
        ciphertext: verification.contactCiphertext,
        keyVersion: verification.keyVersion,
      });
      const allowed = await this.limits.tryConsume(
        context,
        'contact',
        this.contacts.rateLimitSubject(contact),
        rateWindowStart(now),
        'resend',
        this.policy.maxResendsPerHour,
      );
      return allowed ? null : { kind: 'refused', verificationId: verification.id };
    });
    if (throttle) {
      this.record(throttle);
      return result;
    }

    const outcome = await this.uow.execute(async (context): Promise<Resent | Refused> => {
      const verification = await this.verifications.findForUpdate(context, input.verificationId);
      if (!verification) return { kind: 'unavailable' };
      const otp = this.secrets.generateOtp();
      let next: ContactVerification;
      try {
        next = verification.resend(otp.digest, now, this.policy);
      } catch (error) {
        if (isRegistrationError(error)) return { kind: 'refused', verificationId: verification.id };
        throw error;
      }
      await this.verifications.save(context, next);
      return { kind: 'sent', verificationId: next.id, verification: next, otp: otp.plain };
    });
    this.record(outcome);
    if (outcome.kind !== 'sent') return result;

    const { verification, otp } = outcome;
    await this.dispatcher.dispatch({
      kind: 'verify',
      verificationId: verification.id,
      channel: verification.channel,
      sealedContact: { ciphertext: verification.contactCiphertext, keyVersion: verification.keyVersion },
      otp,
      idempotencyKey: `${verification.deliveryIdempotencyKey}:resend:${verification.resendCount}`,
    });
    return result;
  }

  /** Only ids of existing challenges are logged; caller input never reaches telemetry. */
  private record(outcome: Resent | Refused): void {
    this.telemetry.record({
      name: 'verification.resent',
      outcome: outcome.kind,
      verificationId: outcome.verificationId,
    });
  }
}
