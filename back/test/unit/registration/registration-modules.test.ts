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
import { StartRegistration } from '../../../src/modules/registration/application/use-cases/start-registration.use-case';
import { VerifyContact } from '../../../src/modules/registration/application/use-cases/verify-contact.use-case';
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
      CompleteRegistration,
      ExpireStaleRegistrations,
    ]) {
      expect(module.get(useCase)).toBeInstanceOf(useCase);
    }
    expect(module.get(PROFILE_WRITER_PORT)).toBeDefined();
    expect(module.get(INTEREST_CATALOG_READER_PORT)).toBeDefined();
  });
});
