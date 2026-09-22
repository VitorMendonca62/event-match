import { describe, expect, test } from 'bun:test';

import { validateEnv } from '../../src/shared/infrastructure/config/env';

describe('validateEnv', () => {
  test('applies safe defaults', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      HOSTNAME: '0.0.0.0',
      SWAGGER_ENABLED: true,
      SWAGGER_PATH: 'docs',
    });
  });

  test('does not include the invalid value in its diagnostic', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrow('PORT');
    expect(() => validateEnv({ PORT: '70000' })).not.toThrow('70000');
  });
});
