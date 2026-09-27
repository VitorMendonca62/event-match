import type {
  TransactionContext,
  UnitOfWorkPort,
} from '../../../../shared/application/ports/unit-of-work.port';
import { ContactVerification } from '../../domain/entities/contact-verification';
import { isRegistrationError, RegistrationError } from '../../domain/errors/registration.error';
import type {
  RateLimitRepositoryPort,
  VerificationRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import type {
  ContactProtectorPort,
  VerificationSecretPort,
} from '../../domain/ports/outbound/security.ports';
import { ContactIdentifier, type ContactChannel } from '../../domain/value-objects/contact-identifier';
import { REGISTRATION_POLICY, rateWindowStart } from '../../domain/value-objects/verification-policy';
import type { TransactionHook } from '../contracts/transaction-hook';
import type { ContactRetention } from '../services/contact-retention';
import type { VerificationDispatcher } from '../services/verification-dispatcher';

export interface RequestContactVerificationInput {
  readonly channel: ContactChannel;
  readonly contact: string;
  readonly whatsappConsentAt?: Date;
  /** HMAC of the caller's origin produced by the trusted BFF (ADR-023); never an IP address. */
  readonly originFingerprint?: Buffer;
}

/** Identical shape for every outcome, so the response never reveals the contact state (RNF004). */
export interface RequestContactVerificationResult {
  /** Random, unbound id when no challenge was issued; callers must check `issued`. */
  readonly verificationId: string;
  /** Internal only: whether a challenge now exists. Never exposed by presentation adapters. */
  readonly issued: boolean;
  readonly expiresAt: Date;
  readonly nextResendAt: Date;
}

type Outcome =
  | { kind: 'issued'; verification: ContactVerification; otp: string; linkToken: string | null }
  | { kind: 'retained' }
  | { kind: 'locked' }
  | { kind: 'contended' };
type SettledOutcome = { readonly outcome: Outcome; readonly result: RequestContactVerificationResult };

export class RequestContactVerification {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly verifications: VerificationRepositoryPort,
    private readonly limits: RateLimitRepositoryPort,
    private readonly retention: ContactRetention,
    private readonly contacts: ContactProtectorPort,
    private readonly secrets: VerificationSecretPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly dispatcher: VerificationDispatcher,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  async execute(
    input: RequestContactVerificationInput,
    withinTransaction?: TransactionHook<RequestContactVerificationResult>,
  ): Promise<RequestContactVerificationResult> {
    const contact = ContactIdentifier.create(input.channel, input.contact);
    if (contact.channel === 'whatsapp' && !input.whatsappConsentAt) {
      throw new RegistrationError('WHATSAPP_CONSENT_REQUIRED');
    }
    const now = this.clock.now();

    // ADR-015/ADR-023: attempts are counted in their own unit of work, before any business decision.
    const allowed = await this.uow.execute(async (context) => {
      if (
        input.originFingerprint &&
        !(await this.limits.tryConsume(
          context,
          'origin',
          input.originFingerprint,
          rateWindowStart(now),
          'challenge',
          this.policy.maxChallengesPerOriginPerHour,
        ))
      ) {
        return false;
      }
      return this.limits.tryConsume(
        context,
        'contact',
        this.contacts.rateLimitSubject(contact),
        rateWindowStart(now),
        'challenge',
        this.policy.maxChallengesPerHour,
      );
    });
    if (!allowed) {
      this.record('rate_limited', contact.channel);
      const result = this.neutralResult(now);
      await this.runHook(withinTransaction, result);
      return result;
    }

    const { outcome, result } = await this.createChallenge(
      contact,
      input.whatsappConsentAt ?? null,
      now,
      withinTransaction,
    );
    this.record(outcome.kind, contact.channel, outcome.kind === 'issued' ? outcome.verification.id : undefined);

    if (outcome.kind === 'issued') {
      const { verification, otp, linkToken } = outcome;
      await this.dispatcher.dispatch({
        kind: 'verify',
        verificationId: verification.id,
        channel: verification.channel,
        sealedContact: { ciphertext: verification.contactCiphertext, keyVersion: verification.keyVersion },
        otp,
        linkToken,
        idempotencyKey: verification.deliveryIdempotencyKey,
      });
      return result;
    }

    if (outcome.kind === 'retained') {
      // Neutral recovery through the same channel (RNF004, ADR-010).
      await this.dispatcher.dispatch({
        kind: 'recovery_notice',
        channel: contact.channel,
        sealedContact: this.contacts.seal(contact),
        idempotencyKey: this.ids.next(),
      });
    }
    return result;
  }

  private async createChallenge(
    contact: ContactIdentifier,
    whatsappConsentAt: Date | null,
    now: Date,
    withinTransaction?: TransactionHook<RequestContactVerificationResult>,
  ): Promise<SettledOutcome> {
    const contactHash = this.contacts.blindIndex(contact);
    try {
      return await this.uow.execute(async (context): Promise<SettledOutcome> => {
        const active = await this.verifications.findActiveByContactForUpdate(context, contactHash);
        if (active?.isLocked(now)) {
          return this.finish(context, { kind: 'locked' }, now, withinTransaction);
        }
        if (active) await this.verifications.save(context, active.supersede());

        if (await this.retention.isRetained(context, contact.channel, contactHash, now)) {
          return this.finish(context, { kind: 'retained' }, now, withinTransaction);
        }

        const otp = this.secrets.generateOtp();
        // ADR-024: e-mail also carries a single-use link; only its digest is persisted.
        const link = contact.channel === 'email' ? this.secrets.generateLinkToken() : null;
        const sealed = this.contacts.seal(contact);
        const verification = ContactVerification.issue(
          {
            id: this.ids.next(),
            channel: contact.channel,
            contactHash,
            contactCiphertext: sealed.ciphertext,
            keyVersion: sealed.keyVersion,
            otpDigest: otp.digest,
            linkTokenDigest: link?.digest ?? null,
            deliveryIdempotencyKey: this.ids.next(),
            whatsappConsentAt: whatsappConsentAt ? now : null,
          },
          now,
          this.policy,
        );
        await this.verifications.insert(context, verification);
        return this.finish(
          context,
          { kind: 'issued', verification, otp: otp.plain, linkToken: link?.plain ?? null },
          now,
          withinTransaction,
        );
      });
    } catch (error) {
      // A concurrent request for the same contact won the unique index; answer neutrally.
      if (isRegistrationError(error, 'CONTACT_UNAVAILABLE')) {
        const outcome = { kind: 'contended' } as const;
        const result = this.neutralResult(now);
        await this.runHook(withinTransaction, result);
        return { outcome, result };
      }
      throw error;
    }
  }

  private async finish(
    context: TransactionContext,
    outcome: Outcome,
    now: Date,
    withinTransaction?: TransactionHook<RequestContactVerificationResult>,
  ): Promise<SettledOutcome> {
    const result =
      outcome.kind === 'issued'
        ? {
            verificationId: outcome.verification.id,
            issued: true,
            expiresAt: outcome.verification.expiresAt,
            nextResendAt: this.nextResendAt(now),
          }
        : this.neutralResult(now);
    await withinTransaction?.(context, result);
    return { outcome, result };
  }

  private async runHook(
    withinTransaction: TransactionHook<RequestContactVerificationResult> | undefined,
    result: RequestContactVerificationResult,
  ): Promise<void> {
    if (withinTransaction) await this.uow.execute((context) => withinTransaction(context, result));
  }

  private neutralResult(now: Date): RequestContactVerificationResult {
    return {
      verificationId: this.ids.next(),
      issued: false,
      expiresAt: new Date(now.getTime() + this.policy.otpTtlMs),
      nextResendAt: this.nextResendAt(now),
    };
  }

  private nextResendAt(now: Date): Date {
    return new Date(now.getTime() + this.policy.resendIntervalMs);
  }

  private record(outcome: string, channel: ContactChannel, verificationId?: string): void {
    this.telemetry.record({ name: 'verification.requested', outcome, channel, verificationId });
  }
}
