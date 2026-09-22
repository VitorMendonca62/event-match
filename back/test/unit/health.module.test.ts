import { describe, expect, test } from 'bun:test';
import { Test } from '@nestjs/testing';

import { HealthModule } from '../../src/modules/health/health.module';
import { HealthController } from '../../src/modules/health/presentation/http/health.controller';

describe('HealthModule', () => {
  test('resolves the health controller through Nest dependency injection', async () => {
    const module = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    const controller = module.get(HealthController);

    expect(controller.getHealth()).toEqual({
      data: { status: 'ok' },
      message: 'API disponível',
      statusCode: 200,
    });

    await module.close();
  });
});
