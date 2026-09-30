import { describe, expect, test } from 'bun:test';

import { validateEnv } from '../../src/shared/infrastructure/config/env';

const secrets = {
  CONTACT_HASH_KEY: Buffer.alloc(32, 1).toString('base64'),
  CONTACT_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
  VERIFICATION_SECRET_KEY: Buffer.alloc(32, 3).toString('base64'),
  REGISTRATION_FLOW_SECRET: Buffer.alloc(32, 4).toString('base64'),
  BFF_INTERNAL_TOKEN: Buffer.alloc(32, 5).toString('base64'),
  AUTH_SESSION_SECRET: Buffer.alloc(32, 6).toString('base64'),
  VERIFICATION_DELIVERY_MODE: 'noop' as const,
};
const brevoDelivery = {
  VERIFICATION_DELIVERY_MODE: 'brevo',
  BREVO_API_KEY: 'xkeysib-fictitious-test-key',
  EMAIL_FROM: 'EventMatch <nao-responda@example.test>',
  FRONTEND_PUBLIC_URL: 'https://app.example.test',
};

const AUTH_DEFAULTS = {
  AUTH_HTTP_ENABLED: false,
  AUTH_SESSION_ABSOLUTE_TTL_SECONDS: 43_200,
  AUTH_SESSION_IDLE_TTL_SECONDS: 1_800,
  AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS: 2_592_000,
  AUTH_REMEMBERED_IDLE_TTL_SECONDS: 604_800,
  AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: 300,
  AUTH_SESSION_RENEWAL_INTERVAL_SECONDS: 86_400,
  AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS: 60,
  AUTH_MAX_SESSIONS_PER_ACCOUNT: 5,
  AUTH_LOGIN_WINDOW_SECONDS: 900,
  AUTH_LOGIN_CONTACT_LIMIT: 5,
  AUTH_LOGIN_ORIGIN_LIMIT: 30,
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
      REGISTRATION_HTTP_ENABLED: false,
      BREVO_BASE_URL: 'https://api.brevo.com/v3',
      ...AUTH_DEFAULTS,
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

  test('reports a malformed database URL without leaking it or throwing TypeError', () => {
    const invalid = 'not-a-database-url';
    const run = () => validateEnv({ ...secrets, DATABASE_URL: invalid });

    expect(run).toThrow('DATABASE_URL');
    expect(run).not.toThrow(TypeError);
    expect(run).not.toThrow(invalid);
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
    expect(validateEnv({ ...secrets, ...brevoDelivery,
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

  describe('registration delivery and BFF settings (SDD-009)', () => {
    const base = { ...secrets, DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch' };

    test('refuses the noop delivery in production', () => {
      expect(() => validateEnv({ ...base, ...brevoDelivery, NODE_ENV: 'production', VERIFICATION_DELIVERY_MODE: 'noop' }))
        .toThrow('VERIFICATION_DELIVERY_MODE: must be brevo when NODE_ENV is production');
    });

    test('requires the Brevo settings in brevo mode without echoing them', () => {
      const run = () => validateEnv({ ...base, VERIFICATION_DELIVERY_MODE: 'brevo', BREVO_API_KEY: 'xkeysib-secret-value' });
      expect(run).toThrow('EMAIL_FROM');
      expect(run).toThrow('FRONTEND_PUBLIC_URL');
      expect(run).not.toThrow('xkeysib-secret-value');
    });

    test('requires https URLs in production', () => {
      expect(() =>
        validateEnv({ ...base, ...brevoDelivery, NODE_ENV: 'production', FRONTEND_PUBLIC_URL: 'http://app.example.test' }),
      ).toThrow('FRONTEND_PUBLIC_URL: must use https://');
    });

    test.each(['FRONTEND_PUBLIC_URL', 'BREVO_BASE_URL'])('reports a malformed %s without leaking it or throwing TypeError', (name) => {
      const invalid = 'not-an-http-url';
      const run = () => validateEnv({ ...base, ...brevoDelivery, [name]: invalid });

      expect(run).toThrow(name);
      expect(run).not.toThrow(TypeError);
      expect(run).not.toThrow(invalid);
    });

    test.each(['BFF_INTERNAL_TOKEN', 'REGISTRATION_FLOW_SECRET', 'VERIFICATION_DELIVERY_MODE'])('requires %s', (name) => {
      const input: Record<string, string | undefined> = { ...base };
      delete input[name];
      expect(() => validateEnv(input)).toThrow(name);
    });

    test('keeps the registration routes disabled by default', () => {
      expect(validateEnv(base).REGISTRATION_HTTP_ENABLED).toBe(false);
    });
  });
});

describe('authentication policy (SDD-013 §4.2)', () => {
  const { AUTH_SESSION_SECRET: sessionSecret, ...withoutSessionSecret } = secrets;
  const base = { ...withoutSessionSecret, DATABASE_URL: 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch' };
  const production = {
    ...base,
    ...brevoDelivery,
    NODE_ENV: 'production',
    DATABASE_SSL_MODE: 'require',
    AUTH_SESSION_SECRET: sessionSecret,
  };

  test('requires the session secret when the routes are enabled or in production, without echoing it', () => {
    expect(() => validateEnv({ ...base, AUTH_HTTP_ENABLED: 'true' })).toThrow('AUTH_SESSION_SECRET');
    expect(() => validateEnv({ ...production, AUTH_SESSION_SECRET: '' })).toThrow('AUTH_SESSION_SECRET');
    expect(validateEnv({ ...base, AUTH_HTTP_ENABLED: 'true', AUTH_SESSION_SECRET: sessionSecret }).AUTH_HTTP_ENABLED).toBe(true);
    const short = Buffer.alloc(16, 6).toString('base64');
    expect(() => validateEnv({ ...base, AUTH_SESSION_SECRET: short })).toThrow('AUTH_SESSION_SECRET');
    expect(() => validateEnv({ ...base, AUTH_SESSION_SECRET: short })).not.toThrow(short);
  });

  test('keeps the session secret independent from the registration secret', () => {
    expect(() => validateEnv({ ...base, AUTH_SESSION_SECRET: secrets.REGISTRATION_FLOW_SECRET })).toThrow(
      'must differ from REGISTRATION_FLOW_SECRET',
    );
  });

  test.each([
    ['AUTH_SESSION_IDLE_TTL_SECONDS', { AUTH_SESSION_IDLE_TTL_SECONDS: '50000' }],
    ['AUTH_REMEMBERED_IDLE_TTL_SECONDS', { AUTH_REMEMBERED_IDLE_TTL_SECONDS: '3000000' }],
    ['AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS', { AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: '1800' }],
    ['AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS', { AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS: '86400' }],
    ['AUTH_MAX_SESSIONS_PER_ACCOUNT', { AUTH_MAX_SESSIONS_PER_ACCOUNT: '0' }],
  ])('refuses an incoherent %s', (name, override) => {
    expect(() => validateEnv({ ...base, ...override })).toThrow(name);
  });

  test('tests may shorten deadlines, production refuses values below the documented floors', () => {
    const short = { AUTH_SESSION_IDLE_TTL_SECONDS: '20', AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: '5' };
    expect(validateEnv({ ...base, NODE_ENV: 'test', ...short }).AUTH_SESSION_IDLE_TTL_SECONDS).toBe(20);
    expect(() => validateEnv({ ...production, ...short })).toThrow('AUTH_SESSION_IDLE_TTL_SECONDS');
    expect(() => validateEnv({ ...production, AUTH_LOGIN_CONTACT_LIMIT: '6' })).toThrow('AUTH_LOGIN_CONTACT_LIMIT');
    expect(() => validateEnv({ ...production, AUTH_LOGIN_WINDOW_SECONDS: '60' })).toThrow('AUTH_LOGIN_WINDOW_SECONDS');
    expect(validateEnv(production).AUTH_LOGIN_ORIGIN_LIMIT).toBe(30);
  });
});
