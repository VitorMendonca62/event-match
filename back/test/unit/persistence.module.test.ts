import { describe, expect, test } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { validateEnv } from '../../src/shared/infrastructure/config/env';
import { DRIZZLE_DB, PG_POOL } from '../../src/shared/infrastructure/persistence/tokens';
import { PersistenceModule } from '../../src/shared/infrastructure/persistence/persistence.module';

describe('PersistenceModule', () => {
  test('provides singleton pool and Drizzle instances through DI tokens', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          validate: validateEnv,
        }),
        PersistenceModule,
      ],
    }).compile();

    expect(module.get(PG_POOL)).toBe(module.get(PG_POOL));
    expect(module.get(DRIZZLE_DB)).toBe(module.get(DRIZZLE_DB));

    await module.close();
  });
});
