import { describe, expect, test } from 'bun:test';

import { validateEnv } from '../../src/shared/infrastructure/config/env';

const secrets = {
  CONTACT_HASH_KEY: Buffer.alloc(32, 1).toString('base64'),
  CONTACT_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
  VERIFICATION_SECRET_KEY: Buffer.alloc(32, 3).toString('base64'),
};

describe('validateEnv', () => {
  test('applies safe defaults', () => {
    expect(validateEnv({
      DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch',
      ...secrets,
    })).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      HOSTNAME: '0.0.0.0',
      SWAGGER_ENABLED: true,
      SWAGGER_PATH: 'docs',
      DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch',
      DATABASE_POOL_MAX: 1,
      DATABASE_IDLE_TIMEOUT_MS: 10_000,
      DATABASE_CONNECTION_TIMEOUT_MS: 2_000,
      DATABASE_STATEMENT_TIMEOUT_MS: 5_000,
      DATABASE_SSL_MODE: 'disable',
      ...secrets,
    });
  });

  test('does not include the invalid value in its diagnostic', () => {
    expect(() => validateEnv({ ...secrets, DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch', PORT: '70000' })).toThrow('PORT');
    expect(() => validateEnv({ ...secrets, DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch', PORT: '70000' })).not.toThrow('70000');
  });

  test('requires a valid database URL', () => {
    expect(() => validateEnv({ ...secrets })).toThrow('DATABASE_URL');
  });

  test('rejects non-PostgreSQL database URLs', () => {
    expect(() => validateEnv({ ...secrets, DATABASE_URL: 'https://db.example' })).toThrow(
      'DATABASE_URL',
    );
  });

  test('keeps the pool limit fixed at one connection', () => {
    expect(() => validateEnv({ ...secrets,
      DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch',
      DATABASE_POOL_MAX: '2',
    })).toThrow('DATABASE_POOL_MAX');
  });

  test('requires TLS by default in production', () => {
    expect(validateEnv({ ...secrets,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch',
    }).DATABASE_SSL_MODE).toBe('require');
  });

  test('rejects disabled TLS in production', () => {
    expect(() => validateEnv({ ...secrets,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch',
      DATABASE_SSL_MODE: 'disable',
    })).toThrow('DATABASE_SSL_MODE');
  });

  test.each(['disable', 'no-verify'])('rejects sslmode=%s in the database URL', (sslMode) => {
    expect(() => validateEnv({ ...secrets,
      NODE_ENV: 'production',
      DATABASE_URL: `postgresql://eventmatch:eventmatch@localhost:5432/eventmatch?sslmode=${sslMode}`,
    })).toThrow('DATABASE_URL');
  });
});
