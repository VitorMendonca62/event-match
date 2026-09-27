import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { CatalogModule } from '../../../src/modules/catalog/catalog.module';
import { INTEREST_CATALOG_READER_PORT } from '../../../src/modules/catalog/domain/ports/interest-catalog-reader.port';
import { PROFILE_WRITER_PORT } from '../../../src/modules/profiles/domain/ports/profile-writer.port';
import { ProfilesModule } from '../../../src/modules/profiles/profiles.module';
import { CompleteRegistration } from '../../../src/modules/registration/application/use-cases/complete-registration.use-case';
import { ExpireStaleRegistrations } from '../../../src/modules/registration/application/use-cases/expire-stale-registrations.use-case';
import { RequestContactVerification } from '../../../src/modules/registration/application/use-cases/request-contact-verification.use-case';
import { ResendContactVerification } from '../../../src/modules/registration/application/use-cases/resend-contact-verification.use-case';
import { SaveRequiredData } from '../../../src/modules/registration/application/use-cases/save-required-data.use-case';
import { SendEmailDeliveryTest } from '../../../src/modules/registration/application/use-cases/send-email-delivery-test.use-case';
import { StartRegistration } from '../../../src/modules/registration/application/use-cases/start-registration.use-case';
import { VerifyContact } from '../../../src/modules/registration/application/use-cases/verify-contact.use-case';
import { CheckRegistrationEligibility } from '../../../src/modules/registration/application/use-cases/check-registration-eligibility.use-case';
import { RegistrationFlow } from '../../../src/modules/registration/application/use-cases/registration-flow.use-case';
import { VERIFICATION_DELIVERY_PORT } from '../../../src/modules/registration/domain/ports/outbound/security.ports';
import { BrevoVerificationDeliveryAdapter } from '../../../src/modules/registration/infrastructure/delivery/brevo-verification-delivery.adapter';
import { NoopVerificationDeliveryAdapter } from '../../../src/modules/registration/infrastructure/delivery/noop-verification-delivery.adapter';
import { RegistrationModule } from '../../../src/modules/registration/registration.module';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';

describe('registration, profiles and catalog modules', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: validateEnv }),
        ProfilesModule,
        CatalogModule,
        RegistrationModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  test('resolves every use case and cross-context port through DI tokens', () => {
    for (const useCase of [
      RequestContactVerification,
      ResendContactVerification,
      VerifyContact,
      StartRegistration,
      SaveRequiredData,
      SendEmailDeliveryTest,
      CompleteRegistration,
      ExpireStaleRegistrations,
      CheckRegistrationEligibility,
      RegistrationFlow,
    ]) {
      expect(module.get(useCase)).toBeInstanceOf(useCase);
    }
    expect(module.get(PROFILE_WRITER_PORT)).toBeDefined();
    expect(module.get(INTEREST_CATALOG_READER_PORT)).toBeDefined();
  });

  test('composes the noop delivery only when explicitly configured', () => {
    expect(module.get(VERIFICATION_DELIVERY_PORT)).toBeInstanceOf(NoopVerificationDeliveryAdapter);
  });
});

describe('delivery composition in brevo mode (ADR-025/ADR-026)', () => {
  test('builds the Brevo adapter and never the noop', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          validate: (environment) =>
            validateEnv({
              ...environment,
              NODE_ENV: 'production',
              DATABASE_SSL_MODE: 'require',
              VERIFICATION_DELIVERY_MODE: 'brevo',
              BREVO_API_KEY: 'xkeysib-fictitious-module-key',
              EMAIL_FROM: 'EventMatch <nao-responda@example.test>',
              FRONTEND_PUBLIC_URL: 'https://app.example.test',
            }),
        }),
        ProfilesModule,
        CatalogModule,
        RegistrationModule,
      ],
    }).compile();
    try {
      expect(module.get(VERIFICATION_DELIVERY_PORT)).toBeInstanceOf(BrevoVerificationDeliveryAdapter);
    } finally {
      await module.close();
    }
  });
});
