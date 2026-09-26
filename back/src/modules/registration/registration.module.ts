import { Module } from '@nestjs/common';

import { UNIT_OF_WORK_PORT } from '../../shared/application/ports/unit-of-work.port';
import { useCaseProvider } from '../../shared/infrastructure/nest/use-case.provider';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { CatalogModule } from '../catalog/catalog.module';
import { INTEREST_CATALOG_READER_PORT } from '../catalog/domain/ports/interest-catalog-reader.port';
import { PROFILE_WRITER_PORT } from '../profiles/domain/ports/profile-writer.port';
import { ProfilesModule } from '../profiles/profiles.module';
import { ContactRetention } from './application/services/contact-retention';
import { VerificationDispatcher } from './application/services/verification-dispatcher';
import { CompleteRegistration } from './application/use-cases/complete-registration.use-case';
import { ExpireStaleRegistrations } from './application/use-cases/expire-stale-registrations.use-case';
import { RequestContactVerification } from './application/use-cases/request-contact-verification.use-case';
import { ResendContactVerification } from './application/use-cases/resend-contact-verification.use-case';
import { SaveRequiredData } from './application/use-cases/save-required-data.use-case';
import { StartRegistration } from './application/use-cases/start-registration.use-case';
import { VerifyContact } from './application/use-cases/verify-contact.use-case';
import {
  ACCOUNT_REPOSITORY_PORT,
  RATE_LIMIT_REPOSITORY_PORT,
  REGISTRATION_REPOSITORY_PORT,
  TERMS_REPOSITORY_PORT,
  VERIFICATION_REPOSITORY_PORT,
} from './domain/ports/outbound/persistence.ports';
import { REGISTRATION_TELEMETRY_PORT } from './domain/ports/outbound/registration-telemetry.port';
import { CLOCK_PORT, ID_GENERATOR_PORT } from './domain/ports/outbound/runtime.ports';
import {
  COMMON_PASSWORD_CHECKER_PORT,
  CONTACT_PROTECTOR_PORT,
  PASSWORD_HASHER_PORT,
  VERIFICATION_DELIVERY_PORT,
  VERIFICATION_SECRET_PORT,
} from './domain/ports/outbound/security.ports';
import { NoopVerificationDeliveryAdapter } from './infrastructure/delivery/noop-verification-delivery.adapter';
import { LoggerRegistrationTelemetryAdapter } from './infrastructure/observability/logger-registration-telemetry.adapter';
import { DrizzleAccountRepository } from './infrastructure/persistence/repositories/drizzle-account.repository';
import { DrizzleRateLimitRepository } from './infrastructure/persistence/repositories/drizzle-rate-limit.repository';
import { DrizzleRegistrationRepository } from './infrastructure/persistence/repositories/drizzle-registration.repository';
import { DrizzleTermsRepository } from './infrastructure/persistence/repositories/drizzle-terms.repository';
import { DrizzleVerificationRepository } from './infrastructure/persistence/repositories/drizzle-verification.repository';
import { CommonPasswordCheckerAdapter } from './infrastructure/security/common-password-checker.adapter';
import { ContactProtectorAdapter } from './infrastructure/security/contact-protector.adapter';
import { PasswordHasherAdapter } from './infrastructure/security/password-hasher.adapter';
import { SystemClockAdapter, UuidV7GeneratorAdapter } from './infrastructure/security/runtime.adapters';
import { VerificationSecretAdapter } from './infrastructure/security/verification-secret.adapter';

const adapters = [
  { provide: VERIFICATION_REPOSITORY_PORT, useClass: DrizzleVerificationRepository },
  { provide: REGISTRATION_REPOSITORY_PORT, useClass: DrizzleRegistrationRepository },
  { provide: ACCOUNT_REPOSITORY_PORT, useClass: DrizzleAccountRepository },
  { provide: RATE_LIMIT_REPOSITORY_PORT, useClass: DrizzleRateLimitRepository },
  { provide: TERMS_REPOSITORY_PORT, useClass: DrizzleTermsRepository },
  { provide: CONTACT_PROTECTOR_PORT, useClass: ContactProtectorAdapter },
  { provide: VERIFICATION_SECRET_PORT, useClass: VerificationSecretAdapter },
  { provide: PASSWORD_HASHER_PORT, useClass: PasswordHasherAdapter },
  { provide: COMMON_PASSWORD_CHECKER_PORT, useClass: CommonPasswordCheckerAdapter },
  { provide: CLOCK_PORT, useClass: SystemClockAdapter },
  { provide: ID_GENERATOR_PORT, useClass: UuidV7GeneratorAdapter },
  { provide: VERIFICATION_DELIVERY_PORT, useClass: NoopVerificationDeliveryAdapter },
  { provide: REGISTRATION_TELEMETRY_PORT, useClass: LoggerRegistrationTelemetryAdapter },
];

const applicationServices = [
  useCaseProvider(ContactRetention, [REGISTRATION_REPOSITORY_PORT, ACCOUNT_REPOSITORY_PORT, PROFILE_WRITER_PORT]),
  useCaseProvider(VerificationDispatcher, [VERIFICATION_DELIVERY_PORT, REGISTRATION_TELEMETRY_PORT]),
];

const useCases = [
  useCaseProvider(RequestContactVerification, [
    UNIT_OF_WORK_PORT,
    VERIFICATION_REPOSITORY_PORT,
    RATE_LIMIT_REPOSITORY_PORT,
    ContactRetention,
    CONTACT_PROTECTOR_PORT,
    VERIFICATION_SECRET_PORT,
    ID_GENERATOR_PORT,
    CLOCK_PORT,
    VerificationDispatcher,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(ResendContactVerification, [
    UNIT_OF_WORK_PORT,
    VERIFICATION_REPOSITORY_PORT,
    RATE_LIMIT_REPOSITORY_PORT,
    CONTACT_PROTECTOR_PORT,
    VERIFICATION_SECRET_PORT,
    CLOCK_PORT,
    VerificationDispatcher,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(VerifyContact, [
    UNIT_OF_WORK_PORT,
    VERIFICATION_REPOSITORY_PORT,
    VERIFICATION_SECRET_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(StartRegistration, [
    UNIT_OF_WORK_PORT,
    VERIFICATION_REPOSITORY_PORT,
    REGISTRATION_REPOSITORY_PORT,
    ContactRetention,
    PASSWORD_HASHER_PORT,
    COMMON_PASSWORD_CHECKER_PORT,
    ID_GENERATOR_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(SaveRequiredData, [
    UNIT_OF_WORK_PORT,
    REGISTRATION_REPOSITORY_PORT,
    ACCOUNT_REPOSITORY_PORT,
    PROFILE_WRITER_PORT,
    ID_GENERATOR_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(CompleteRegistration, [
    UNIT_OF_WORK_PORT,
    ACCOUNT_REPOSITORY_PORT,
    PROFILE_WRITER_PORT,
    INTEREST_CATALOG_READER_PORT,
    TERMS_REPOSITORY_PORT,
    ID_GENERATOR_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(ExpireStaleRegistrations, [
    UNIT_OF_WORK_PORT,
    REGISTRATION_REPOSITORY_PORT,
    ACCOUNT_REPOSITORY_PORT,
    PROFILE_WRITER_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
];

/** Internal registration flow (SDD-007); no controllers until the HTTP slice. */
@Module({
  imports: [PersistenceModule, ProfilesModule, CatalogModule],
  providers: [...adapters, ...applicationServices, ...useCases],
  exports: [
    RequestContactVerification,
    ResendContactVerification,
    VerifyContact,
    StartRegistration,
    SaveRequiredData,
    CompleteRegistration,
    ExpireStaleRegistrations,
  ],
})
export class RegistrationModule {}
