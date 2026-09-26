import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import { Registration } from '../../domain/entities/registration';
import { RegistrationError } from '../../domain/errors/registration.error';
import type {
  RegistrationRepositoryPort,
  VerificationRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import type {
  CommonPasswordCheckerPort,
  PasswordHasherPort,
} from '../../domain/ports/outbound/security.ports';
import { Password } from '../../domain/value-objects/password';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';
import type { ContactRetention } from '../services/contact-retention';

export interface StartRegistrationResult {
  readonly registrationId: string;
  readonly expiresAt: Date;
}

export class StartRegistration {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly verifications: VerificationRepositoryPort,
    private readonly registrations: RegistrationRepositoryPort,
    private readonly retention: ContactRetention,
    private readonly hasher: PasswordHasherPort,
    private readonly commonPasswords: CommonPasswordCheckerPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  /** Consumes a verified challenge and creates the registration in the same transaction. */
  async execute(input: { verificationId: string; password: string }): Promise<StartRegistrationResult> {
    const password = Password.create(input.password);
    if (this.commonPasswords.isCommon(password)) throw new RegistrationError('WEAK_PASSWORD');
    // Argon2id runs before the transaction so no lock is held during hashing.
    const passwordHash = await this.hasher.hash(password);

    const registration = await this.uow.execute(async (context) => {
      const now = this.clock.now();
      const verification = await this.verifications.findForUpdate(context, input.verificationId);
      if (!verification) throw new RegistrationError('VERIFICATION_UNAVAILABLE');
      const consumed = verification.consume(now);

      if (await this.retention.isRetained(context, verification.channel, verification.contactHash, now)) {
        throw new RegistrationError('CONTACT_UNAVAILABLE');
      }

      const created = Registration.start(
        {
          id: this.ids.next(),
          verificationId: verification.id,
          channel: verification.channel,
          retained: {
            contactHash: verification.contactHash,
            contactCiphertext: verification.contactCiphertext,
            keyVersion: verification.keyVersion,
            passwordHash,
          },
        },
        now,
        this.policy,
      );
      await this.verifications.save(context, consumed);
      await this.registrations.insert(context, created);
      return created;
    });

    this.telemetry.record({
      name: 'registration.started',
      outcome: 'started',
      channel: registration.channel,
      verificationId: registration.verificationId,
      registrationId: registration.id,
    });
    return { registrationId: registration.id, expiresAt: registration.expiresAt };
  }
}
