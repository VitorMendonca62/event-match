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
import type { TransactionHook } from '../contracts/transaction-hook';
import type { VerificationDispatcher } from '../services/verification-dispatcher';

export interface ResendContactVerificationResult {
  /** Challenge window when sent; the policy window otherwise, so the shape never differs. */
  readonly expiresAt: Date;
  readonly nextResendAt: Date;
}

type Resent = {
  kind: 'sent';
  verificationId: string;
  verification: ContactVerification;
  otp: string;
  linkToken: string | null;
};
type Refused = { kind: 'unavailable'; verificationId?: undefined } | { kind: 'refused'; verificationId: string };
type SettledOutcome = {
  readonly outcome: Resent | Refused;
  readonly result: ResendContactVerificationResult;
};

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

  /**
   * Always answers with the same shape; unknown, locked or throttled challenges are not revealed.
   * A null id stands for a flow that never received a challenge (neutral request, RNF004).
   */
  async execute(
    input: { verificationId: string | null },
    withinTransaction?: TransactionHook<ResendContactVerificationResult>,
  ): Promise<ResendContactVerificationResult> {
    const now = this.clock.now();
    const result = {
      expiresAt: new Date(now.getTime() + this.policy.otpTtlMs),
      nextResendAt: new Date(now.getTime() + this.policy.resendIntervalMs),
    };
    const verificationId = input.verificationId;
    if (verificationId === null) {
      this.record({ kind: 'unavailable' });
      await this.runHook(withinTransaction, result);
      return result;
    }

    // ADR-015: count against the contact that owns the challenge, never a caller-supplied subject.
    const throttle = await this.uow.execute(async (context): Promise<Refused | null> => {
      const verification = await this.verifications.findById(context, verificationId);
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
      await this.runHook(withinTransaction, result);
      return result;
    }

    const settled = await this.uow.execute(async (context): Promise<SettledOutcome> => {
      const verification = await this.verifications.findForUpdate(context, verificationId);
      if (!verification) {
        const outcome = { kind: 'unavailable' } as const;
        await withinTransaction?.(context, result);
        return { outcome, result };
      }
      const otp = this.secrets.generateOtp();
      const link = verification.channel === 'email' ? this.secrets.generateLinkToken() : null;
      let next: ContactVerification;
      try {
        next = verification.resend(otp.digest, link?.digest ?? null, now, this.policy);
      } catch (error) {
        if (isRegistrationError(error)) {
          const outcome = { kind: 'refused', verificationId: verification.id } as const;
          await withinTransaction?.(context, result);
          return { outcome, result };
        }
        throw error;
      }
      await this.verifications.save(context, next);
      const outcome = {
        kind: 'sent',
        verificationId: next.id,
        verification: next,
        otp: otp.plain,
        linkToken: link?.plain ?? null,
      } as const;
      const sentResult = { ...result, expiresAt: next.expiresAt };
      await withinTransaction?.(context, sentResult);
      return { outcome, result: sentResult };
    });
    const { outcome } = settled;
    this.record(outcome);
    if (outcome.kind !== 'sent') return settled.result;

    const { verification, otp, linkToken } = outcome;
    await this.dispatcher.dispatch({
      kind: 'verify',
      verificationId: verification.id,
      channel: verification.channel,
      sealedContact: { ciphertext: verification.contactCiphertext, keyVersion: verification.keyVersion },
      otp,
      linkToken,
      idempotencyKey: `${verification.deliveryIdempotencyKey}:resend:${verification.resendCount}`,
    });
    return settled.result;
  }

  private async runHook(
    withinTransaction: TransactionHook<ResendContactVerificationResult> | undefined,
    result: ResendContactVerificationResult,
  ): Promise<void> {
    if (withinTransaction) await this.uow.execute((context) => withinTransaction(context, result));
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
