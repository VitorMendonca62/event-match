import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { InterestCatalogReaderPort } from '../../../catalog/domain/ports/interest-catalog-reader.port';
import type { ProfileWriterPort } from '../../../profiles/domain/ports/profile-writer.port';
import { Account } from '../../domain/entities/account';
import { ContactVerification } from '../../domain/entities/contact-verification';
import { Registration } from '../../domain/entities/registration';
import { RegistrationError } from '../../domain/errors/registration.error';
import type { AccountRepositoryPort, RateLimitRepositoryPort, RegistrationRepositoryPort, TermsRepositoryPort, VerificationRepositoryPort } from '../../domain/ports/outbound/persistence.ports';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import type { CommonPasswordCheckerPort, ContactProtectorPort, PasswordHasherPort, VerificationDeliveryPort, VerificationSecretPort } from '../../domain/ports/outbound/security.ports';
import { BirthDate } from '../../domain/value-objects/birth-date';
import { ContactIdentifier, type ContactChannel } from '../../domain/value-objects/contact-identifier';
import { Password } from '../../domain/value-objects/password';
import { DisplayName, Region, UsageIntent } from '../../domain/value-objects/profile-fields';
import { VerificationPolicy } from '../../domain/value-objects/verification-policy';

type RequestInput = { channel: ContactChannel; contact: string; whatsappConsentAt?: Date };
const hour = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()));

export class RequestContactVerification {
  private readonly policy = new VerificationPolicy();
  constructor(private readonly uow: UnitOfWorkPort, private readonly verifications: VerificationRepositoryPort, private readonly limits: RateLimitRepositoryPort, private readonly accounts: AccountRepositoryPort, private readonly contacts: ContactProtectorPort, private readonly secrets: VerificationSecretPort, private readonly ids: IdGeneratorPort, private readonly clock: ClockPort, private readonly delivery: VerificationDeliveryPort) {}
  async execute(input: RequestInput): Promise<{ verificationId: string; expiresAt: Date; nextResendAt: Date }> {
    const contact = ContactIdentifier.create(input.channel, input.contact); const hash = this.contacts.blindIndex(contact); const now = this.clock.now();
    const allowed = await this.uow.execute((ctx) => this.limits.tryConsume(ctx, 'contact', hash, hour(now), 'challenge', this.policy.maxChallengesPerHour));
    if (!allowed) return { verificationId: this.ids.next(), expiresAt: new Date(now.getTime() + this.policy.otpTtlMs), nextResendAt: new Date(now.getTime() + this.policy.resendIntervalMs) };
    const result = await this.uow.execute(async (ctx) => { await this.verifications.expireOpen(ctx, hash, now); if (await this.accounts.existsHoldingContact(ctx, contact.channel, hash)) return null; const otp = this.secrets.generateOtp(); const sealed = this.contacts.seal(contact); const entity = new ContactVerification(this.ids.next(), contact.channel, hash, sealed.ciphertext, sealed.keyVersion, otp.digest, new Date(now.getTime() + this.policy.otpTtlMs), this.ids.next(), now); await this.verifications.insert(ctx, entity); return entity; });
    if (result) await this.delivery.send({ verificationId: result.id, channel: result.channel, sealedContact: { ciphertext: result.ciphertext, keyVersion: result.keyVersion }, kind: 'verify', idempotencyKey: result.deliveryIdempotencyKey });
    return { verificationId: result?.id ?? this.ids.next(), expiresAt: result?.expiresAt ?? new Date(now.getTime() + this.policy.otpTtlMs), nextResendAt: new Date(now.getTime() + this.policy.resendIntervalMs) };
  }
}

export class ResendContactVerification {
  private readonly policy = new VerificationPolicy();
  constructor(private readonly uow: UnitOfWorkPort, private readonly verifications: VerificationRepositoryPort, private readonly limits: RateLimitRepositoryPort, private readonly clock: ClockPort) {}
  async execute(input: { verificationId: string; contactHash: Buffer }): Promise<{ nextResendAt: Date }> { const now = this.clock.now(); await this.uow.execute((ctx) => this.limits.tryConsume(ctx, 'contact', input.contactHash, hour(now), 'resend', this.policy.maxResends)); return this.uow.execute(async (ctx) => { const value = await this.verifications.findForUpdate(ctx, input.verificationId); if (!value) throw new RegistrationError('VERIFICATION_UNAVAILABLE'); const next = value.resend(now, this.policy); await this.verifications.save(ctx, next); return { nextResendAt: new Date(now.getTime() + this.policy.resendIntervalMs) }; }); }
}

export class VerifyContact {
  private readonly policy = new VerificationPolicy();
  constructor(private readonly uow: UnitOfWorkPort, private readonly verifications: VerificationRepositoryPort, private readonly secrets: VerificationSecretPort, private readonly clock: ClockPort) {}
  async execute(input: { verificationId: string; otp: string }): Promise<{ verificationId: string; verified: boolean }> { return this.uow.execute(async (ctx) => { const value = await this.verifications.findForUpdate(ctx, input.verificationId); if (!value) return { verificationId: input.verificationId, verified: false }; try { const next = value.verify(this.secrets.matches(input.otp, value.otpDigest), this.clock.now(), this.policy); await this.verifications.save(ctx, next); return { verificationId: value.id, verified: next.status === 'verified' }; } catch { return { verificationId: value.id, verified: false }; } }); }
}

export class StartRegistration {
  constructor(private readonly uow: UnitOfWorkPort, private readonly verifications: VerificationRepositoryPort, private readonly registrations: RegistrationRepositoryPort, private readonly hasher: PasswordHasherPort, private readonly commonPasswords: CommonPasswordCheckerPort, private readonly ids: IdGeneratorPort, private readonly clock: ClockPort) {}
  async execute(input: { verificationId: string; password: string }): Promise<{ registrationId: string; expiresAt: Date }> { const password = Password.create(input.password); if (this.commonPasswords.isCommon(password)) throw new RegistrationError('WEAK_PASSWORD'); const hash = await this.hasher.hash(password); return this.uow.execute(async (ctx) => { const verification = await this.verifications.findForUpdate(ctx, input.verificationId); if (!verification || verification.status !== 'verified') throw new RegistrationError('VERIFICATION_UNAVAILABLE'); const now = this.clock.now(); const value = new Registration(this.ids.next(), verification.id, verification.channel, verification.contactHash, verification.ciphertext, verification.keyVersion, hash, now, new Date(now.getTime() + 86_400_000)); await this.registrations.insert(ctx, value); await this.verifications.save(ctx, verification.consume(now)); return { registrationId: value.id, expiresAt: value.expiresAt }; }); }
}

export class SaveRequiredData {
  constructor(private readonly uow: UnitOfWorkPort, private readonly registrations: RegistrationRepositoryPort, private readonly accounts: AccountRepositoryPort, private readonly profiles: ProfileWriterPort, private readonly ids: IdGeneratorPort, private readonly clock: ClockPort) {}
  async execute(input: { registrationId: string; displayName: string; region: string; birthDate: string; usageIntents: string[] }): Promise<{ accountId: string }> { const displayName = DisplayName.create(input.displayName); const region = Region.create(input.region); const birthDate = BirthDate.create(input.birthDate); const intents = input.usageIntents.map(UsageIntent.create); if (!intents.length) throw new RegistrationError('INVALID_USAGE_INTENTS'); return this.uow.execute(async (ctx) => { const registration = await this.registrations.findInProgressForUpdate(ctx, input.registrationId); if (!registration || !registration.contactHash || !registration.ciphertext || !registration.passwordHash) throw new RegistrationError('REGISTRATION_UNAVAILABLE'); const now = this.clock.now(); const value = new Account(this.ids.next(), registration.id, 'account_incomplete', birthDate, now); await this.accounts.insertIncomplete(ctx, { account: value, channel: registration.channel, contactHash: registration.contactHash, ciphertext: registration.ciphertext, keyVersion: registration.keyVersion ?? 1, passwordHash: registration.passwordHash }); await this.profiles.upsertRequired(ctx, value.id, { displayName, region, birthDate: birthDate.value }); await this.profiles.replaceUsageIntents(ctx, value.id, intents); await this.registrations.save(ctx, registration.expire(now)); return { accountId: value.id }; }); }
}

export class CompleteRegistration {
  constructor(private readonly uow: UnitOfWorkPort, private readonly accounts: AccountRepositoryPort, private readonly profiles: ProfileWriterPort, private readonly interests: InterestCatalogReaderPort, private readonly terms: TermsRepositoryPort, private readonly clock: ClockPort) {}
  async execute(input: { accountId: string; interestIds: string[]; documentIds: string[] }): Promise<{ accountId: string; status: 'active' }> { return this.uow.execute(async (ctx) => { const value = await this.accounts.findForUpdate(ctx, input.accountId); const now = this.clock.now(); if (!value || !value.birthDate?.isAdultAt(now)) throw new RegistrationError('ACCOUNT_CANNOT_BE_ACTIVATED'); const interests = await this.interests.findActiveByIds(ctx, [...new Set(input.interestIds)]); const documents = await this.terms.findApproved(ctx, [...new Set(input.documentIds)]); if (interests.length < 3 || new Set(documents.map((d) => d.kind)).size !== 3) throw new RegistrationError('ACCOUNT_CANNOT_BE_ACTIVATED'); await this.profiles.replaceInterests(ctx, value.id, interests.map((i) => i.id)); await this.terms.recordAcceptances(ctx, value.id, documents.map((d) => d.id), now); await this.accounts.save(ctx, value.activate(now)); return { accountId: value.id, status: 'active' }; }); }
}

export class ExpireStaleRegistrations {
  constructor(private readonly uow: UnitOfWorkPort, private readonly registrations: RegistrationRepositoryPort, private readonly accounts: AccountRepositoryPort, private readonly clock: ClockPort) {}
  async execute(batch = 100): Promise<{ registrations: number; accounts: number }> { return this.uow.execute(async (ctx) => { const now = this.clock.now(); return { registrations: await this.registrations.expireStale(ctx, now, batch), accounts: await this.accounts.expireStale(ctx, now, batch) }; }); }
}
