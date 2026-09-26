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

  test.each([
    ['a placeholder', 'replace-with-a-base64-secret-of-at-least-32-bytes', 'must be standard base64'],
    ['an empty value', '', 'must decode to at least 32 bytes'],
    ['a short key', Buffer.alloc(16).toString('base64'), 'must decode to at least 32 bytes'],
  ])('rejects %s as a secret without echoing it', (_label, value, reason) => {
    const run = () => validateEnv({
      ...secrets,
      DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch',
      CONTACT_HASH_KEY: value,
    });
    expect(run).toThrow(`CONTACT_HASH_KEY: ${reason}`);
    if (value) expect(run).not.toThrow(value);
  });

  test('requires an AES-256 key of exactly 32 bytes', () => {
    expect(() => validateEnv({
      ...secrets,
      DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch',
      CONTACT_ENCRYPTION_KEY: Buffer.alloc(48).toString('base64'),
    })).toThrow('CONTACT_ENCRYPTION_KEY: must decode to exactly 32 bytes');
  });
});
