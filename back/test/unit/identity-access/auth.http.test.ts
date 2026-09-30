import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';

import { AuthenticateAccount } from '../../../src/modules/identity-access/application/use-cases/authenticate-account.use-case';
import { Logout } from '../../../src/modules/identity-access/application/use-cases/logout.use-case';
import { ResolveAuthenticatedSession } from '../../../src/modules/identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { IdentityAccessError } from '../../../src/modules/identity-access/domain/errors/identity-access.error';
import { IdentityAccessModule } from '../../../src/modules/identity-access/identity-access.module';
import { configureApplication } from '../../../src/main';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';

const BFF = { 'X-EventMatch-BFF-Token': process.env.BFF_INTERNAL_TOKEN! };
const TOKEN = 'A'.repeat(43);
const ROTATED = 'B'.repeat(43);
const FINGERPRINT = Buffer.alloc(32, 7).toString('base64url');
const BASE = '/api/v1/auth';
const EXPIRES = new Date('2026-09-30T00:00:00.000Z');
const IDLE = new Date('2026-09-29T12:30:00.000Z');
const LOGIN = { email: 'ana@example.test', password: 'uma senha longa e rara', rememberMe: false };
const UNAUTHORIZED = { data: {}, message: 'Authentication is required.', statusCode: 401 };

const authenticate = {
  execute: mock(async (): Promise<unknown> => ({ token: TOKEN, expiresAt: EXPIRES, idleExpiresAt: IDLE, remembered: false })),
};
const resolveSession = {
  execute: mock(async (): Promise<unknown> => ({
    accountId: '00000000-0000-7000-8000-000000000001',
    sessionId: '00000000-0000-7000-8000-000000000002',
    expiresAt: EXPIRES,
    idleExpiresAt: IDLE,
    remembered: true,
    rotationDue: false,
    rotatedToken: null,
  })),
};
const logout = { execute: mock(async () => ({ loggedOut: true })) };

async function createApp(overrides: Record<string, string> = {}): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        validate: (environment) => validateEnv({ ...environment, ...overrides }),
      }),
      IdentityAccessModule,
    ],
  })
    .overrideProvider(AuthenticateAccount)
    .useValue(authenticate)
    .overrideProvider(ResolveAuthenticatedSession)
    .useValue(resolveSession)
    .overrideProvider(Logout)
    .useValue(logout)
    .compile();
  const app = module.createNestApplication();
  configureApplication(app);
  await app.init();
  return app;
}

describe('auth HTTP contract v1 (SDD-013 §4.3)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const loginHeaders = { ...BFF, 'X-EventMatch-Origin-Fingerprint': FINGERPRINT };

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authenticate.execute.mockClear();
    resolveSession.execute.mockClear();
    logout.execute.mockClear();
  });

  describe('BFF boundary', () => {
    test.each([
      ['missing', {}],
      ['wrong', { 'X-EventMatch-BFF-Token': Buffer.alloc(32, 8).toString('base64') }],
    ])('rejects a %s internal token before any use case, with no-store', async (_label, headers) => {
      const response = await http().post(`${BASE}/login`).set(headers).send(LOGIN).expect(401);
      expect(response.body).toEqual(UNAUTHORIZED);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(authenticate.execute).not.toHaveBeenCalled();
    });

    test('answers 404 while AUTH_HTTP_ENABLED is off', async () => {
      const disabled = await createApp({ AUTH_HTTP_ENABLED: 'false' });
      try {
        await request(disabled.getHttpServer()).post(`${BASE}/login`).set(loginHeaders).send(LOGIN).expect(404);
        await request(disabled.getHttpServer()).get(`${BASE}/session`).set({ ...BFF, Authorization: `Bearer ${TOKEN}` }).expect(404);
      } finally {
        await disabled.close();
      }
    });

    test('refuses to start with the flag on and no session secret', async () => {
      await expect(createApp({ AUTH_SESSION_SECRET: '' })).rejects.toThrow('AUTH_SESSION_SECRET');
    });
  });

  describe('POST /auth/login', () => {
    test('returns deadlines only; the token travels in the internal header', async () => {
      const response = await http().post(`${BASE}/login`).set(loginHeaders).send(LOGIN).expect(200);

      expect(response.body).toEqual({
        data: {
          authenticated: true,
          expiresAt: EXPIRES.toISOString(),
          idleExpiresAt: IDLE.toISOString(),
          remembered: false,
        },
        message: 'Sessão iniciada.',
        statusCode: 200,
      });
      expect(response.headers['x-eventmatch-session']).toBe(TOKEN);
      expect(JSON.stringify(response.body)).not.toContain(TOKEN);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers['cache-control']).toBe('no-store');
      expect(authenticate.execute).toHaveBeenCalledWith({
        ...LOGIN,
        originFingerprint: Buffer.from(FINGERPRINT, 'base64url'),
      });
    });

    test.each([
      ['a missing fingerprint', {}, LOGIN],
      ['a forged forwarding header', { 'X-Forwarded-For': '203.0.113.9' }, LOGIN],
    ])('rejects %s with 400', async (_label, extra, body) => {
      await http().post(`${BASE}/login`).set({ ...BFF, ...extra }).send(body).expect(400);
      expect(authenticate.execute).not.toHaveBeenCalled();
    });

    test.each([
      ['a malformed e-mail', { ...LOGIN, email: 'not-an-email' }],
      ['an oversized e-mail', { ...LOGIN, email: `${'a'.repeat(320)}@example.test` }],
      ['an empty password', { ...LOGIN, password: '' }],
      ['an oversized password', { ...LOGIN, password: 'x'.repeat(257) }],
      ['a non-boolean remember me', { ...LOGIN, rememberMe: 'true' }],
      ['an unknown field', { ...LOGIN, accountId: 'x' }],
    ])('rejects %s without echoing input', async (_label, body) => {
      const response = await http().post(`${BASE}/login`).set(loginHeaders).send(body).expect(400);
      expect(response.body).toEqual({ data: {}, message: 'Invalid request.', statusCode: 400 });
      expect(authenticate.execute).not.toHaveBeenCalled();
    });

    test('invalid credentials are the same 401 as a missing BFF token', async () => {
      authenticate.execute.mockImplementationOnce(async () => {
        throw new IdentityAccessError('INVALID_CREDENTIALS');
      });
      const response = await http().post(`${BASE}/login`).set(loginHeaders).send(LOGIN).expect(401);
      expect(response.body).toEqual(UNAUTHORIZED);
      expect(response.headers['x-eventmatch-session']).toBeUndefined();
    });

    test('rate limiting is a generic 429 without bucket or wait time', async () => {
      authenticate.execute.mockImplementationOnce(async () => {
        throw new IdentityAccessError('RATE_LIMITED');
      });
      const response = await http().post(`${BASE}/login`).set(loginHeaders).send(LOGIN).expect(429);
      expect(response.body).toEqual({ data: {}, message: 'Too many requests.', statusCode: 429 });
      expect(response.headers['retry-after']).toBeUndefined();
    });

    test('an internal failure is a generic 500, never invalid credentials', async () => {
      authenticate.execute.mockImplementationOnce(async () => {
        throw new Error('database password=secret');
      });
      const response = await http().post(`${BASE}/login`).set(loginHeaders).send(LOGIN).expect(500);
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });
  });

  describe('GET /auth/session', () => {
    const sessionHeaders = { ...BFF, Authorization: `Bearer ${TOKEN}` };

    test('validates without rotating by default and reports deadlines only', async () => {
      const response = await http().get(`${BASE}/session`).set(sessionHeaders).expect(200);
      expect(response.body.data).toEqual({
        authenticated: true,
        expiresAt: EXPIRES.toISOString(),
        idleExpiresAt: IDLE.toISOString(),
        remembered: true,
        rotationDue: false,
      });
      expect(JSON.stringify(response.body)).not.toContain('00000000-0000-7000');
      expect(resolveSession.execute).toHaveBeenCalledWith({ token: TOKEN, capability: 'authenticated_home', allowRotation: false });
    });

    test('rotation is opt-in and the new token only leaves in the internal header', async () => {
      resolveSession.execute.mockImplementationOnce(async () => ({
        accountId: 'a',
        sessionId: 's',
        expiresAt: EXPIRES,
        idleExpiresAt: IDLE,
        remembered: true,
        rotationDue: false,
        rotatedToken: ROTATED,
      }));
      const response = await http().get(`${BASE}/session?rotate=true&capability=logout`).set(sessionHeaders).expect(200);
      expect(response.headers['x-eventmatch-session']).toBe(ROTATED);
      expect(JSON.stringify(response.body)).not.toContain(ROTATED);
      expect(resolveSession.execute).toHaveBeenCalledWith({ token: TOKEN, capability: 'logout', allowRotation: true });
    });

    test.each([
      ['no bearer', BFF],
      ['a malformed bearer', { ...BFF, Authorization: 'Bearer short' }],
    ])('refuses %s with the neutral 401', async (_label, headers) => {
      const response = await http().get(`${BASE}/session`).set(headers).expect(401);
      expect(response.body).toEqual(UNAUTHORIZED);
      expect(resolveSession.execute).not.toHaveBeenCalled();
    });

    test('rejects an unknown capability with 400', async () => {
      await http().get(`${BASE}/session?capability=admin`).set(sessionHeaders).expect(400);
    });

    test.each(['SESSION_EXPIRED', 'SESSION_REVOKED'] as const)('%s is the neutral 401', async (code) => {
      resolveSession.execute.mockImplementationOnce(async () => {
        throw new IdentityAccessError(code);
      });
      const response = await http().get(`${BASE}/session`).set(sessionHeaders).expect(401);
      expect(response.body).toEqual(UNAUTHORIZED);
    });

    test('a denied capability is a generic 403', async () => {
      resolveSession.execute.mockImplementationOnce(async () => {
        throw new IdentityAccessError('CAPABILITY_DENIED');
      });
      const response = await http().get(`${BASE}/session`).set(sessionHeaders).expect(403);
      expect(response.body).toEqual({
        data: {},
        message: 'You do not have permission to perform this action.',
        statusCode: 403,
      });
    });
  });

  describe('POST /auth/logout', () => {
    test('revokes the presented session', async () => {
      const response = await http().post(`${BASE}/logout`).set({ ...BFF, Authorization: `Bearer ${TOKEN}` }).expect(200);
      expect(response.body).toEqual({ data: { loggedOut: true }, message: 'Sessão encerrada.', statusCode: 200 });
      expect(logout.execute).toHaveBeenCalledWith({ token: TOKEN });
    });

    test('without a bearer answers the neutral 401', async () => {
      await http().post(`${BASE}/logout`).set(BFF).expect(401);
      expect(logout.execute).not.toHaveBeenCalled();
    });
  });

  test('documents every route with tags, operations, envelopes and error responses', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const login = document.paths[`${BASE}/login`]?.post;
    const session = document.paths[`${BASE}/session`]?.get;
    const logoutPath = document.paths[`${BASE}/logout`]?.post;
    for (const operation of [login, session, logoutPath]) {
      expect(operation?.tags).toEqual(['auth']);
      expect(operation?.summary).toBeTruthy();
      expect(Object.keys(operation?.responses ?? {})).toEqual(expect.arrayContaining(['200', '400', '401', '404', '503']));
    }
    expect(Object.keys(login?.responses ?? {})).toContain('429');
    expect(Object.keys(session?.responses ?? {})).toContain('403');
    expect(document.components?.schemas).toHaveProperty('LoginResponseDto');
    expect(document.components?.schemas).toHaveProperty('SessionResponseDto');
  });
});
