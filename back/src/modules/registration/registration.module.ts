import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';

import { UNIT_OF_WORK_PORT } from '../../shared/application/ports/unit-of-work.port';
import type { BackendEnv } from '../../shared/infrastructure/config/env';
import { useCaseProvider } from '../../shared/infrastructure/nest/use-case.provider';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { CatalogModule } from '../catalog/catalog.module';
import { INTEREST_CATALOG_READER_PORT } from '../catalog/domain/ports/interest-catalog-reader.port';
import { PROFILE_WRITER_PORT } from '../profiles/domain/ports/profile-writer.port';
import { ProfilesModule } from '../profiles/profiles.module';
import { ContactRetention } from './application/services/contact-retention';
import { RegistrationFlowGate } from './application/services/registration-flow-gate';
import { VerificationDispatcher } from './application/services/verification-dispatcher';
import { CheckRegistrationEligibility } from './application/use-cases/check-registration-eligibility.use-case';
import { CompleteRegistration } from './application/use-cases/complete-registration.use-case';
import { ExpireStaleRegistrations } from './application/use-cases/expire-stale-registrations.use-case';
import { RequestContactVerification } from './application/use-cases/request-contact-verification.use-case';
import { ListCurrentLegalDocuments } from './application/use-cases/list-current-legal-documents.use-case';
import { RegistrationFlow } from './application/use-cases/registration-flow.use-case';
import { ResendContactVerification } from './application/use-cases/resend-contact-verification.use-case';
import { SaveRequiredData } from './application/use-cases/save-required-data.use-case';
import { CancelRegistration } from './application/use-cases/cancel-registration.use-case';
import { SendEmailDeliveryTest } from './application/use-cases/send-email-delivery-test.use-case';
import { StartRegistration } from './application/use-cases/start-registration.use-case';
import { VerifyContact } from './application/use-cases/verify-contact.use-case';
import { VerifyContactByLink } from './application/use-cases/verify-contact-by-link.use-case';
import {
  REGISTRATION_FLOW_SESSION_REPOSITORY_PORT,
  REGISTRATION_FLOW_TOKEN_PORT,
  REGISTRATION_IDEMPOTENCY_REPOSITORY_PORT,
} from './domain/ports/outbound/flow.ports';
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
import { BrevoVerificationDeliveryAdapter } from './infrastructure/delivery/brevo-verification-delivery.adapter';
import { NoopVerificationDeliveryAdapter } from './infrastructure/delivery/noop-verification-delivery.adapter';
import { LoggerRegistrationTelemetryAdapter } from './infrastructure/observability/logger-registration-telemetry.adapter';
import { DrizzleAccountRepository } from './infrastructure/persistence/repositories/drizzle-account.repository';
import { DrizzleFlowSessionRepository } from './infrastructure/persistence/repositories/drizzle-flow-session.repository';
import { DrizzleIdempotencyRepository } from './infrastructure/persistence/repositories/drizzle-idempotency.repository';
import { DrizzleRateLimitRepository } from './infrastructure/persistence/repositories/drizzle-rate-limit.repository';
import { DrizzleRegistrationRepository } from './infrastructure/persistence/repositories/drizzle-registration.repository';
import { DrizzleTermsRepository } from './infrastructure/persistence/repositories/drizzle-terms.repository';
import { DrizzleVerificationRepository } from './infrastructure/persistence/repositories/drizzle-verification.repository';
import { CommonPasswordCheckerAdapter } from './infrastructure/security/common-password-checker.adapter';
import { ContactProtectorAdapter } from './infrastructure/security/contact-protector.adapter';
import { PasswordHasherAdapter } from './infrastructure/security/password-hasher.adapter';
import { RegistrationFlowTokenAdapter } from './infrastructure/security/registration-flow-token.adapter';
import { SystemClockAdapter, UuidV7GeneratorAdapter } from './infrastructure/security/runtime.adapters';
import { VerificationSecretAdapter } from './infrastructure/security/verification-secret.adapter';
import { BffInternalGuard } from './presentation/http/bff-internal.guard';
import { ContinuationGuard } from './presentation/http/continuation.guard';
import { EmailDeliveryTestGuard } from './presentation/http/email-delivery-test.guard';
import { NoStoreMiddleware } from '../../shared/presentation/http/no-store.middleware';
import { RegistrationController } from './presentation/http/controllers/registration.controller';

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
  { provide: REGISTRATION_FLOW_SESSION_REPOSITORY_PORT, useClass: DrizzleFlowSessionRepository },
  { provide: REGISTRATION_IDEMPOTENCY_REPOSITORY_PORT, useClass: DrizzleIdempotencyRepository },
  { provide: REGISTRATION_FLOW_TOKEN_PORT, useClass: RegistrationFlowTokenAdapter },
  {
    // ADR-025/ADR-026: only the configured adapter is built; production refuses `noop` at startup.
    provide: VERIFICATION_DELIVERY_PORT,
    inject: [ConfigService, ModuleRef],
    useFactory: (config: ConfigService<BackendEnv, true>, moduleRef: ModuleRef) =>
      config.getOrThrow<string>('VERIFICATION_DELIVERY_MODE') === 'brevo'
        ? moduleRef.create(BrevoVerificationDeliveryAdapter)
        : moduleRef.create(NoopVerificationDeliveryAdapter),
  },
  { provide: REGISTRATION_TELEMETRY_PORT, useClass: LoggerRegistrationTelemetryAdapter },
];

const applicationServices = [
  useCaseProvider(ContactRetention, [REGISTRATION_REPOSITORY_PORT, ACCOUNT_REPOSITORY_PORT, PROFILE_WRITER_PORT]),
  useCaseProvider(VerificationDispatcher, [VERIFICATION_DELIVERY_PORT, REGISTRATION_TELEMETRY_PORT]),
  useCaseProvider(RegistrationFlowGate, [
    UNIT_OF_WORK_PORT,
    REGISTRATION_FLOW_SESSION_REPOSITORY_PORT,
    REGISTRATION_IDEMPOTENCY_REPOSITORY_PORT,
    REGISTRATION_FLOW_TOKEN_PORT,
    ID_GENERATOR_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
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
    REGISTRATION_FLOW_SESSION_REPOSITORY_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(CancelRegistration, [
    UNIT_OF_WORK_PORT,
    REGISTRATION_FLOW_SESSION_REPOSITORY_PORT,
    REGISTRATION_FLOW_TOKEN_PORT,
    REGISTRATION_REPOSITORY_PORT,
    ACCOUNT_REPOSITORY_PORT,
    PROFILE_WRITER_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(VerifyContactByLink, [
    UNIT_OF_WORK_PORT,
    VERIFICATION_REPOSITORY_PORT,
    VERIFICATION_SECRET_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(CheckRegistrationEligibility, [
    UNIT_OF_WORK_PORT,
    REGISTRATION_FLOW_SESSION_REPOSITORY_PORT,
    REGISTRATION_FLOW_TOKEN_PORT,
    ID_GENERATOR_PORT,
    CLOCK_PORT,
    REGISTRATION_TELEMETRY_PORT,
  ]),
  useCaseProvider(ListCurrentLegalDocuments, [UNIT_OF_WORK_PORT, TERMS_REPOSITORY_PORT, CLOCK_PORT]),
  useCaseProvider(SendEmailDeliveryTest, [CONTACT_PROTECTOR_PORT, VERIFICATION_DELIVERY_PORT, ID_GENERATOR_PORT]),
  useCaseProvider(RegistrationFlow, [
    RegistrationFlowGate,
    UNIT_OF_WORK_PORT,
    REGISTRATION_FLOW_SESSION_REPOSITORY_PORT,
    REGISTRATION_FLOW_TOKEN_PORT,
    CLOCK_PORT,
    RequestContactVerification,
    ResendContactVerification,
    VerifyContact,
    VerifyContactByLink,
    StartRegistration,
    SaveRequiredData,
    CompleteRegistration,
  ]),
];

/** Registration flow (SDD-007) and its HTTP contract v1 for the Next.js BFF (SDD-009). */
@Module({
  imports: [PersistenceModule, ProfilesModule, CatalogModule],
  controllers: [RegistrationController],
  providers: [
    ...adapters,
    ...applicationServices,
    ...useCases,
    BffInternalGuard,
    ContinuationGuard,
    EmailDeliveryTestGuard,
  ],
  exports: [
    RequestContactVerification,
    ResendContactVerification,
    VerifyContact,
    StartRegistration,
    SaveRequiredData,
    CompleteRegistration,
    ExpireStaleRegistrations,
    CheckRegistrationEligibility,
    RegistrationFlow,
    CancelRegistration,
  ],
})
export class RegistrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(NoStoreMiddleware).forRoutes(RegistrationController);
  }
}
