import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { AuthenticateAccount } from '../../../src/modules/identity-access/application/use-cases/authenticate-account.use-case';
import { Logout } from '../../../src/modules/identity-access/application/use-cases/logout.use-case';
import { ResolveAuthenticatedSession } from '../../../src/modules/identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { SESSION_POLICY, type SessionPolicy } from '../../../src/modules/identity-access/domain/services/session-policy';
import { LoginEmail } from '../../../src/modules/identity-access/domain/value-objects/login-email';
import { IdentityAccessModule } from '../../../src/modules/identity-access/identity-access.module';
import { LoggerAuthenticationTelemetryAdapter } from '../../../src/modules/identity-access/infrastructure/observability/logger-authentication-telemetry.adapter';
import { DefaultAccountAccessPolicyAdapter } from '../../../src/modules/identity-access/infrastructure/security/default-account-access-policy.adapter';
import { LoginSubjectAdapter } from '../../../src/modules/identity-access/infrastructure/security/login-subject.adapter';
import { PasswordVerifierAdapter } from '../../../src/modules/identity-access/infrastructure/security/password-verifier.adapter';
import { SessionTokenAdapter } from '../../../src/modules/identity-access/infrastructure/security/session-token.adapter';
import { ContactProtectorAdapter } from '../../../src/modules/registration/infrastructure/security/contact-protector.adapter';
import { RegistrationFlowTokenAdapter } from '../../../src/modules/registration/infrastructure/security/registration-flow-token.adapter';
import { ContactIdentifier } from '../../../src/modules/registration/domain/value-objects/contact-identifier';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';
import { DEFAULT_POLICY } from '../../support/identity-access-fakes';

describe('IdentityAccessModule composition', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: validateEnv }), IdentityAccessModule],
    }).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  test('resolves every use case through DI tokens and builds the default policy', () => {
    for (const useCase of [AuthenticateAccount, ResolveAuthenticatedSession, Logout]) {
      expect(module.get(useCase)).toBeInstanceOf(useCase);
    }
    expect(module.get<SessionPolicy>(SESSION_POLICY)).toEqual(DEFAULT_POLICY);
  });

  test('uses no forwardRef and never imports the registration context', () => {
    const root = join(process.cwd(), 'src/modules/identity-access');
    const files = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect({ file, source }).not.toMatchObject({ source: expect.stringMatching(/forwardRef|modules\/registration|\.\.\/registration\//) });
    }
  });
});

describe('identity-access security adapters', () => {
  const config = new ConfigService(validateEnv(process.env)) as ConfigService<never, true>;

  test('session tokens have 256 bits and only an HMAC under AUTH_SESSION_SECRET is derived', () => {
    const adapter = new SessionTokenAdapter(config);
    const issued = adapter.issue();
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(issued.token, 'base64url')).toHaveLength(32);
    expect(Buffer.from(issued.digest)).toEqual(Buffer.from(adapter.digest(issued.token)));
    expect(Buffer.from(issued.digest).toString('base64url')).not.toBe(issued.token);
    // Separate key domain from the registration continuation.
    const continuation = new RegistrationFlowTokenAdapter(config).digest(issued.token);
    expect(Buffer.from(issued.digest).equals(continuation)).toBe(false);
  });

  test('a missing secret fails on use instead of issuing an unkeyed token', () => {
    const adapter = new SessionTokenAdapter({ get: () => undefined } as never);
    expect(() => adapter.issue()).toThrow('AUTH_SESSION_SECRET');
  });

  test('the login e-mail hash equals the registration blind index; the rate subject does not', () => {
    const subjects = new LoginSubjectAdapter(config);
    const registration = new ContactProtectorAdapter(config);
    const email = LoginEmail.normalize('Ana@Example.test')!;
    const contact = ContactIdentifier.create('email', 'ana@example.test');
    expect(Buffer.from(subjects.emailHash(email)).equals(registration.blindIndex(contact))).toBe(true);
    expect(Buffer.from(subjects.contactRateSubject(email)).equals(registration.blindIndex(contact))).toBe(false);
    expect(Buffer.from(subjects.contactRateSubject(email)).equals(registration.rateLimitSubject(contact))).toBe(false);
  });

  test('Argon2id verification matches registration hashes and the dummy path verifies too', async () => {
    const verifier = new PasswordVerifierAdapter();
    const hash = await Bun.password.hash('uma senha longa e rara', { algorithm: 'argon2id' });
    expect(await verifier.verify('uma senha longa e rara', hash)).toBe(true);
    expect(await verifier.verify('outra', hash)).toBe(false);
    await expect(verifier.verifyDummy('qualquer')).resolves.toBeUndefined();
  });

  test('the default policy allows only published capabilities of active accounts', async () => {
    const policy = new DefaultAccountAccessPolicyAdapter();
    expect(await policy.decide('a', 'active', 'authenticated_home')).toBe('allow');
    expect(await policy.decide('a', 'active', 'logout')).toBe('allow');
    expect(await policy.decide('a', 'suspended', 'logout')).toBe('deny');
    expect(await policy.decide('a', 'active', 'admin' as never)).toBe('deny');
  });

  test('telemetry writes only allowlisted fields', () => {
    const log = spyOn(Logger, 'log').mockImplementation(() => undefined);
    try {
      new LoggerAuthenticationTelemetryAdapter().record({
        name: 'login',
        outcome: 'rate_limited',
        correlationId: 'c',
        durationMs: 12.4,
        scope: 'contact',
        email: 'ana@example.test',
      } as never);
      const [line] = log.mock.calls[0] as [string];
      expect(JSON.parse(line)).toEqual({
        event: 'identity_access.login',
        outcome: 'rate_limited',
        correlationId: 'c',
        durationMs: 12,
        scope: 'contact',
      });
    } finally {
      log.mockRestore();
    }
  });
});
