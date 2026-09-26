import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { COMMON_PASSWORD_CHECKER_PORT, CONTACT_PROTECTOR_PORT, PASSWORD_HASHER_PORT, VERIFICATION_DELIVERY_PORT, VERIFICATION_SECRET_PORT } from './domain/ports/outbound/security.ports';
import { CLOCK_PORT, ID_GENERATOR_PORT } from './domain/ports/outbound/runtime.ports';
import { ACCOUNT_REPOSITORY_PORT, RATE_LIMIT_REPOSITORY_PORT, REGISTRATION_REPOSITORY_PORT, TERMS_REPOSITORY_PORT, VERIFICATION_REPOSITORY_PORT } from './domain/ports/outbound/persistence.ports';
import { CommonPasswordCheckerAdapter } from './infrastructure/security/common-password-checker.adapter';
import { ContactProtectorAdapter } from './infrastructure/security/contact-protector.adapter';
import { PasswordHasherAdapter } from './infrastructure/security/password-hasher.adapter';
import { VerificationSecretAdapter } from './infrastructure/security/verification-secret.adapter';
import { SystemClockAdapter, UuidV7GeneratorAdapter } from './infrastructure/security/runtime.adapters';
import { NoopVerificationDeliveryAdapter } from './infrastructure/delivery/noop-verification-delivery.adapter';
import { DrizzleAccountRepository, DrizzleRateLimitRepository, DrizzleRegistrationRepository, DrizzleTermsRepository, DrizzleVerificationRepository } from './infrastructure/persistence/repositories/drizzle-registration.repositories';
import { CompleteRegistration, ExpireStaleRegistrations, RequestContactVerification, ResendContactVerification, SaveRequiredData, StartRegistration, VerifyContact } from './application/use-cases/registration.use-cases';
import { UNIT_OF_WORK_PORT, type UnitOfWorkPort } from '../../shared/application/ports/unit-of-work.port';
import { PROFILE_WRITER_PORT, type ProfileWriterPort } from '../profiles/domain/ports/profile-writer.port';
import { INTEREST_CATALOG_READER_PORT, type InterestCatalogReaderPort } from '../catalog/domain/ports/interest-catalog-reader.port';
import type { AccountRepositoryPort, RateLimitRepositoryPort, RegistrationRepositoryPort, TermsRepositoryPort, VerificationRepositoryPort } from './domain/ports/outbound/persistence.ports';
import type { ClockPort, IdGeneratorPort } from './domain/ports/outbound/runtime.ports';
import type { CommonPasswordCheckerPort, ContactProtectorPort, PasswordHasherPort, VerificationDeliveryPort, VerificationSecretPort } from './domain/ports/outbound/security.ports';

const requestVerificationProvider = { provide: RequestContactVerification, inject: [UNIT_OF_WORK_PORT, VERIFICATION_REPOSITORY_PORT, RATE_LIMIT_REPOSITORY_PORT, ACCOUNT_REPOSITORY_PORT, CONTACT_PROTECTOR_PORT, VERIFICATION_SECRET_PORT, ID_GENERATOR_PORT, CLOCK_PORT, VERIFICATION_DELIVERY_PORT], useFactory: (uow: UnitOfWorkPort, verification: VerificationRepositoryPort, limit: RateLimitRepositoryPort, account: AccountRepositoryPort, contact: ContactProtectorPort, secret: VerificationSecretPort, id: IdGeneratorPort, clock: ClockPort, delivery: VerificationDeliveryPort) => new RequestContactVerification(uow, verification, limit, account, contact, secret, id, clock, delivery) };
const resendProvider = { provide: ResendContactVerification, inject: [UNIT_OF_WORK_PORT, VERIFICATION_REPOSITORY_PORT, RATE_LIMIT_REPOSITORY_PORT, CLOCK_PORT], useFactory: (uow: UnitOfWorkPort, verification: VerificationRepositoryPort, limit: RateLimitRepositoryPort, clock: ClockPort) => new ResendContactVerification(uow, verification, limit, clock) };
const verifyProvider = { provide: VerifyContact, inject: [UNIT_OF_WORK_PORT, VERIFICATION_REPOSITORY_PORT, VERIFICATION_SECRET_PORT, CLOCK_PORT], useFactory: (uow: UnitOfWorkPort, verification: VerificationRepositoryPort, secret: VerificationSecretPort, clock: ClockPort) => new VerifyContact(uow, verification, secret, clock) };
const startProvider = { provide: StartRegistration, inject: [UNIT_OF_WORK_PORT, VERIFICATION_REPOSITORY_PORT, REGISTRATION_REPOSITORY_PORT, PASSWORD_HASHER_PORT, COMMON_PASSWORD_CHECKER_PORT, ID_GENERATOR_PORT, CLOCK_PORT], useFactory: (uow: UnitOfWorkPort, verification: VerificationRepositoryPort, registration: RegistrationRepositoryPort, hasher: PasswordHasherPort, common: CommonPasswordCheckerPort, id: IdGeneratorPort, clock: ClockPort) => new StartRegistration(uow, verification, registration, hasher, common, id, clock) };
const requiredDataProvider = { provide: SaveRequiredData, inject: [UNIT_OF_WORK_PORT, REGISTRATION_REPOSITORY_PORT, ACCOUNT_REPOSITORY_PORT, PROFILE_WRITER_PORT, ID_GENERATOR_PORT, CLOCK_PORT], useFactory: (uow: UnitOfWorkPort, registration: RegistrationRepositoryPort, account: AccountRepositoryPort, profile: ProfileWriterPort, id: IdGeneratorPort, clock: ClockPort) => new SaveRequiredData(uow, registration, account, profile, id, clock) };
const completeProvider = { provide: CompleteRegistration, inject: [UNIT_OF_WORK_PORT, ACCOUNT_REPOSITORY_PORT, PROFILE_WRITER_PORT, INTEREST_CATALOG_READER_PORT, TERMS_REPOSITORY_PORT, CLOCK_PORT], useFactory: (uow: UnitOfWorkPort, account: AccountRepositoryPort, profile: ProfileWriterPort, interest: InterestCatalogReaderPort, terms: TermsRepositoryPort, clock: ClockPort) => new CompleteRegistration(uow, account, profile, interest, terms, clock) };
const expireProvider = { provide: ExpireStaleRegistrations, inject: [UNIT_OF_WORK_PORT, REGISTRATION_REPOSITORY_PORT, ACCOUNT_REPOSITORY_PORT, CLOCK_PORT], useFactory: (uow: UnitOfWorkPort, registration: RegistrationRepositoryPort, account: AccountRepositoryPort, clock: ClockPort) => new ExpireStaleRegistrations(uow, registration, account, clock) };

@Module({
  imports: [PersistenceModule, ProfilesModule, CatalogModule],
  providers: [
    ContactProtectorAdapter, VerificationSecretAdapter, PasswordHasherAdapter, CommonPasswordCheckerAdapter, SystemClockAdapter, UuidV7GeneratorAdapter, NoopVerificationDeliveryAdapter,
    DrizzleVerificationRepository, DrizzleRegistrationRepository, DrizzleAccountRepository, DrizzleRateLimitRepository, DrizzleTermsRepository,
    requestVerificationProvider, resendProvider, verifyProvider, startProvider, requiredDataProvider, completeProvider, expireProvider,
    { provide: CONTACT_PROTECTOR_PORT, useExisting: ContactProtectorAdapter },
    { provide: VERIFICATION_SECRET_PORT, useExisting: VerificationSecretAdapter },
    { provide: PASSWORD_HASHER_PORT, useExisting: PasswordHasherAdapter },
    { provide: COMMON_PASSWORD_CHECKER_PORT, useExisting: CommonPasswordCheckerAdapter },
    { provide: CLOCK_PORT, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR_PORT, useExisting: UuidV7GeneratorAdapter },
    { provide: VERIFICATION_DELIVERY_PORT, useExisting: NoopVerificationDeliveryAdapter },
    { provide: VERIFICATION_REPOSITORY_PORT, useExisting: DrizzleVerificationRepository },
    { provide: REGISTRATION_REPOSITORY_PORT, useExisting: DrizzleRegistrationRepository },
    { provide: ACCOUNT_REPOSITORY_PORT, useExisting: DrizzleAccountRepository },
    { provide: RATE_LIMIT_REPOSITORY_PORT, useExisting: DrizzleRateLimitRepository },
    { provide: TERMS_REPOSITORY_PORT, useExisting: DrizzleTermsRepository },
  ],
  exports: [CONTACT_PROTECTOR_PORT, VERIFICATION_SECRET_PORT, PASSWORD_HASHER_PORT, COMMON_PASSWORD_CHECKER_PORT],
})
export class RegistrationModule {}
