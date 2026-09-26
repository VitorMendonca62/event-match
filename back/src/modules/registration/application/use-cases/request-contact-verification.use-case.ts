import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
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
import type { ContactRetention } from '../services/contact-retention';
import type { VerificationDispatcher } from '../services/verification-dispatcher';

export interface RequestContactVerificationInput {
  readonly channel: ContactChannel;
  readonly contact: string;
  readonly whatsappConsentAt?: Date;
}

/** Identical shape for every outcome, so the response never reveals the contact state (RNF004). */
export interface RequestContactVerificationResult {
  readonly verificationId: string;
  readonly expiresAt: Date;
  readonly nextResendAt: Date;
}

type Outcome =
  | { kind: 'issued'; verification: ContactVerification; otp: string }
  | { kind: 'retained' }
  | { kind: 'locked' }
  | { kind: 'contended' };

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

  async execute(input: RequestContactVerificationInput): Promise<RequestContactVerificationResult> {
    const contact = ContactIdentifier.create(input.channel, input.contact);
    if (contact.channel === 'whatsapp' && !input.whatsappConsentAt) {
      throw new RegistrationError('WHATSAPP_CONSENT_REQUIRED');
    }
    const now = this.clock.now();

    // ADR-015: the attempt is counted in its own unit of work, before any business decision.
    const allowed = await this.uow.execute((context) =>
      this.limits.tryConsume(
        context,
        'contact',
        this.contacts.rateLimitSubject(contact),
        rateWindowStart(now),
        'challenge',
        this.policy.maxChallengesPerHour,
      ),
    );
    if (!allowed) {
      this.record('rate_limited', contact.channel);
      return this.neutralResult(now);
    }

    const outcome = await this.createChallenge(contact, input.whatsappConsentAt ?? null, now);
    this.record(outcome.kind, contact.channel, outcome.kind === 'issued' ? outcome.verification.id : undefined);

    if (outcome.kind === 'issued') {
      const { verification, otp } = outcome;
      await this.dispatcher.dispatch({
        kind: 'verify',
        verificationId: verification.id,
        channel: verification.channel,
        sealedContact: { ciphertext: verification.contactCiphertext, keyVersion: verification.keyVersion },
        otp,
        idempotencyKey: verification.deliveryIdempotencyKey,
      });
      return {
        verificationId: verification.id,
        expiresAt: verification.expiresAt,
        nextResendAt: this.nextResendAt(now),
      };
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
    return this.neutralResult(now);
  }

  private async createChallenge(
    contact: ContactIdentifier,
    whatsappConsentAt: Date | null,
    now: Date,
  ): Promise<Outcome> {
    const contactHash = this.contacts.blindIndex(contact);
    try {
      return await this.uow.execute(async (context): Promise<Outcome> => {
        const active = await this.verifications.findActiveByContactForUpdate(context, contactHash);
        if (active?.isLocked(now)) return { kind: 'locked' };
        if (active) await this.verifications.save(context, active.supersede());

        if (await this.retention.isRetained(context, contact.channel, contactHash, now)) {
          return { kind: 'retained' };
        }

        const otp = this.secrets.generateOtp();
        const sealed = this.contacts.seal(contact);
        const verification = ContactVerification.issue(
          {
            id: this.ids.next(),
            channel: contact.channel,
            contactHash,
            contactCiphertext: sealed.ciphertext,
            keyVersion: sealed.keyVersion,
            otpDigest: otp.digest,
            deliveryIdempotencyKey: this.ids.next(),
            whatsappConsentAt: whatsappConsentAt ? now : null,
          },
          now,
          this.policy,
        );
        await this.verifications.insert(context, verification);
        return { kind: 'issued', verification, otp: otp.plain };
      });
    } catch (error) {
      // A concurrent request for the same contact won the unique index; answer neutrally.
      if (isRegistrationError(error, 'CONTACT_UNAVAILABLE')) return { kind: 'contended' };
      throw error;
    }
  }

  private neutralResult(now: Date): RequestContactVerificationResult {
    return {
      verificationId: this.ids.next(),
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
