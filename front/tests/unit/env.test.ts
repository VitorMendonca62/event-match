import { describe, expect, test } from 'bun:test';

import { formatEnvError, parseEnv } from '../../src/shared/config/env.server';

describe('parseEnv', () => {
  test('applies safe defaults', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
    });
  });

  test('rejects an invalid port without including its value in the formatted error', () => {
    try {
      parseEnv({ PORT: '70000' });
    } catch (error) {
      const message = formatEnvError(error as import('zod').ZodError);

      expect(message).toContain('PORT');
      expect(message).not.toContain('70000');
      return;
    }

    throw new Error('Expected invalid PORT to be rejected');
  });
});
