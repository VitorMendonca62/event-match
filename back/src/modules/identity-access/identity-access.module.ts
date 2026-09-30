import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UNIT_OF_WORK_PORT } from '../../shared/application/ports/unit-of-work.port';
import type { BackendEnv } from '../../shared/infrastructure/config/env';
import { useCaseProvider } from '../../shared/infrastructure/nest/use-case.provider';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { NoStoreMiddleware } from '../../shared/presentation/http/no-store.middleware';
import { AuthenticateAccount } from './application/use-cases/authenticate-account.use-case';
import { Logout } from './application/use-cases/logout.use-case';
import { ResolveAuthenticatedSession } from './application/use-cases/resolve-authenticated-session.use-case';
import { ACCOUNT_ACCESS_POLICY_PORT } from './domain/ports/outbound/account-access-policy.port';
import { AUTHENTICATION_ACCOUNT_READER_PORT } from './domain/ports/outbound/authentication-account-reader.port';
import { AUTHENTICATION_ATTEMPT_REPOSITORY_PORT } from './domain/ports/outbound/authentication-attempt-repository.port';
import { AUTHENTICATED_SESSION_REPOSITORY_PORT } from './domain/ports/outbound/authenticated-session-repository.port';
import {
  LOGIN_SUBJECT_PORT,
  PASSWORD_VERIFIER_PORT,
  SESSION_TOKEN_PORT,
} from './domain/ports/outbound/authentication-security.ports';
import { AUTHENTICATION_TELEMETRY_PORT } from './domain/ports/outbound/authentication-telemetry.port';
import { IDENTITY_CLOCK_PORT, IDENTITY_ID_GENERATOR_PORT } from './domain/ports/outbound/runtime.ports';
import { SESSION_POLICY } from './domain/services/session-policy';
import { sessionPolicyFromConfig } from './infrastructure/config/session-policy.factory';
import { LoggerAuthenticationTelemetryAdapter } from './infrastructure/observability/logger-authentication-telemetry.adapter';
import { DrizzleAuthenticationAccountReader } from './infrastructure/persistence/repositories/drizzle-authentication-account.reader';
import { DrizzleAuthenticationAttemptRepository } from './infrastructure/persistence/repositories/drizzle-authentication-attempt.repository';
import { DrizzleAuthenticatedSessionRepository } from './infrastructure/persistence/repositories/drizzle-authenticated-session.repository';
import { IdentitySystemClockAdapter, IdentityUuidV7GeneratorAdapter } from './infrastructure/runtime.adapters';
import { DefaultAccountAccessPolicyAdapter } from './infrastructure/security/default-account-access-policy.adapter';
import { LoginSubjectAdapter } from './infrastructure/security/login-subject.adapter';
import { PasswordVerifierAdapter } from './infrastructure/security/password-verifier.adapter';
import { SessionTokenAdapter } from './infrastructure/security/session-token.adapter';
import { AuthBffGuard } from './presentation/http/auth-bff.guard';
import { AuthController } from './presentation/http/controllers/auth.controller';

const adapters = [
  { provide: AUTHENTICATED_SESSION_REPOSITORY_PORT, useClass: DrizzleAuthenticatedSessionRepository },
  { provide: AUTHENTICATION_ATTEMPT_REPOSITORY_PORT, useClass: DrizzleAuthenticationAttemptRepository },
  { provide: AUTHENTICATION_ACCOUNT_READER_PORT, useClass: DrizzleAuthenticationAccountReader },
  { provide: ACCOUNT_ACCESS_POLICY_PORT, useClass: DefaultAccountAccessPolicyAdapter },
  { provide: PASSWORD_VERIFIER_PORT, useClass: PasswordVerifierAdapter },
  { provide: SESSION_TOKEN_PORT, useClass: SessionTokenAdapter },
  { provide: LOGIN_SUBJECT_PORT, useClass: LoginSubjectAdapter },
  { provide: AUTHENTICATION_TELEMETRY_PORT, useClass: LoggerAuthenticationTelemetryAdapter },
  { provide: IDENTITY_CLOCK_PORT, useClass: IdentitySystemClockAdapter },
  { provide: IDENTITY_ID_GENERATOR_PORT, useClass: IdentityUuidV7GeneratorAdapter },
  {
    provide: SESSION_POLICY,
    inject: [ConfigService],
    useFactory: (config: ConfigService<BackendEnv, true>) => sessionPolicyFromConfig(config),
  },
];

const useCases = [
  useCaseProvider(AuthenticateAccount, [
    UNIT_OF_WORK_PORT,
    AUTHENTICATION_ATTEMPT_REPOSITORY_PORT,
    AUTHENTICATION_ACCOUNT_READER_PORT,
    AUTHENTICATED_SESSION_REPOSITORY_PORT,
    ACCOUNT_ACCESS_POLICY_PORT,
    PASSWORD_VERIFIER_PORT,
    SESSION_TOKEN_PORT,
    LOGIN_SUBJECT_PORT,
    IDENTITY_CLOCK_PORT,
    IDENTITY_ID_GENERATOR_PORT,
    AUTHENTICATION_TELEMETRY_PORT,
    SESSION_POLICY,
  ]),
  useCaseProvider(ResolveAuthenticatedSession, [
    UNIT_OF_WORK_PORT,
    AUTHENTICATED_SESSION_REPOSITORY_PORT,
    AUTHENTICATION_ACCOUNT_READER_PORT,
    ACCOUNT_ACCESS_POLICY_PORT,
    SESSION_TOKEN_PORT,
    IDENTITY_CLOCK_PORT,
    IDENTITY_ID_GENERATOR_PORT,
    AUTHENTICATION_TELEMETRY_PORT,
    SESSION_POLICY,
  ]),
  useCaseProvider(Logout, [
    UNIT_OF_WORK_PORT,
    AUTHENTICATED_SESSION_REPOSITORY_PORT,
    SESSION_TOKEN_PORT,
    IDENTITY_CLOCK_PORT,
    IDENTITY_ID_GENERATOR_PORT,
    AUTHENTICATION_TELEMETRY_PORT,
  ]),
];

/**
 * Identity and access (SDD-013, ADR-033..036): common sessions, login limits and live
 * authorization. It depends only on shared persistence; the account tables produced by
 * registration are read through a projection, never through registration's code.
 */
@Module({
  imports: [PersistenceModule],
  controllers: [AuthController],
  providers: [...adapters, ...useCases, AuthBffGuard],
  exports: [AuthenticateAccount, ResolveAuthenticatedSession, Logout],
})
export class IdentityAccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(NoStoreMiddleware).forRoutes(AuthController);
  }
}
