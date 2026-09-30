import { describe, expect, test } from 'bun:test';

import { parseBffEnv } from '../../src/shared/config/bff-env.server';
import {
  expiredSessionCookie,
  readSessionCookie,
  REMEMBERED_COOKIE_MAX_AGE_SECONDS,
  serializeSessionCookie,
  sessionCookieName,
} from '../../src/shared/server/authentication-cookie';
import { proxyLogin, proxyLogout, proxySessionMaintenance } from '../../src/shared/server/authentication-bff';
import { resolveSessionView } from '../../src/shared/server/authenticated-view';
import { browserRequest, fakeBackend, ROTATED, SECRET, TOKEN, testEnv } from './bff-fixtures';

const silent = () => {};
const NOW = new Date('2026-09-29T12:00:00.000Z');
const LOGIN = { email: 'ana@example.test', password: 'uma senha longa e rara', rememberMe: false };
const DEADLINES = {
  authenticated: true,
  expiresAt: '2026-09-30T00:00:00.000Z',
  idleExpiresAt: '2026-09-29T12:30:00.000Z',
  remembered: false,
};
const SESSION_HEADER = { 'x-eventmatch-session': TOKEN };

async function json(response: Response) {
  return (await response.json()) as { data: Record<string, unknown>; message: string; statusCode: number };
}

describe('session cookie (ADR-034)', () => {
  test('production: __Host-, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain and no persistence by default', () => {
    const cookie = serializeSessionCookie(TOKEN, DEADLINES, { NODE_ENV: 'production' }, NOW);
    expect(cookie).toBe(`__Host-eventmatch_session=${TOKEN}; Path=/; HttpOnly; SameSite=Lax; Secure`);
    expect(cookie).not.toMatch(/Max-Age|Expires|Domain/);
  });

  test('local/test uses the plain name without Secure', () => {
    expect(sessionCookieName({ NODE_ENV: 'development' })).toBe('eventmatch_session');
    expect(serializeSessionCookie(TOKEN, DEADLINES, { NODE_ENV: 'test' }, NOW)).not.toContain('Secure');
  });

  test('remembered cookies persist only until the absolute deadline, capped at 30 days', () => {
    const remembered = { remembered: true, expiresAt: '2026-10-29T12:00:00.000Z' };
    expect(serializeSessionCookie(TOKEN, remembered, { NODE_ENV: 'test' }, NOW)).toContain(
      `Max-Age=${REMEMBERED_COOKIE_MAX_AGE_SECONDS}`,
    );
    const shorter = { remembered: true, expiresAt: '2026-09-29T13:00:00.000Z' };
    expect(serializeSessionCookie(TOKEN, shorter, { NODE_ENV: 'test' }, NOW)).toContain('Max-Age=3600');
    const beyond = { remembered: true, expiresAt: '2027-01-01T00:00:00.000Z' };
    expect(serializeSessionCookie(TOKEN, beyond, { NODE_ENV: 'test' }, NOW)).toContain(
      `Max-Age=${REMEMBERED_COOKIE_MAX_AGE_SECONDS}`,
    );
  });

  test('reads only a well-formed token under its own name and never the registration cookie', () => {
    const env = { NODE_ENV: 'test' as const };
    expect(readSessionCookie(`a=1; eventmatch_session=${TOKEN}`, env)).toBe(TOKEN);
    expect(readSessionCookie('eventmatch_session=../../etc', env)).toBeUndefined();
    expect(readSessionCookie(`eventmatch_registration=${TOKEN}`, env)).toBeUndefined();
    expect(expiredSessionCookie(env)).toBe('eventmatch_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  });

  test('the UI flag is server-only and off by default', () => {
    const valid = {
      BACKEND_INTERNAL_URL: 'http://backend.test',
      FRONTEND_PUBLIC_URL: 'http://app.test',
      BFF_INTERNAL_TOKEN: SECRET,
      ORIGIN_FINGERPRINT_KEY: SECRET,
      EDGE_PROVIDER: 'fixture',
    };
    expect(parseBffEnv(valid).AUTH_UI_ENABLED).toBe(false);
    expect(parseBffEnv({ ...valid, AUTH_UI_ENABLED: 'true' }).AUTH_UI_ENABLED).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  const env = testEnv();
  const login = (init: Parameters<typeof browserRequest>[1] = {}) =>
    browserRequest('/api/auth/login', { body: LOGIN, ...init });

  test('forwards credentials once with the internal headers and moves the token into the cookie only', async () => {
    const backend = fakeBackend(200, DEADLINES, SESSION_HEADER);
    const response = await proxyLogin(login(), { env, fetchImpl: backend.fetchImpl, now: () => NOW, log: silent });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ data: { authenticated: true }, message: 'Request completed successfully.', statusCode: 200 });
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('expiresAt');
    expect(response.headers.get('set-cookie')).toBe(`eventmatch_session=${TOKEN}; Path=/; HttpOnly; SameSite=Lax`);
    expect(response.headers.get('x-eventmatch-session')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');

    expect(backend.calls).toHaveLength(1);
    const [call] = backend.calls;
    expect(call?.url).toBe('http://backend.test/api/v1/auth/login');
    expect(call?.init.headers.get('x-eventmatch-bff-token')).toBe(SECRET);
    expect(call?.init.headers.get('x-eventmatch-origin-fingerprint')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(call?.init.headers.get('authorization')).toBeNull();
    expect(call?.init.headers.get('cookie')).toBeNull();
    expect(JSON.parse(String(call?.init.body))).toEqual(LOGIN);
  });

  test('remember me yields a persistent cookie bounded by the absolute deadline', async () => {
    const backend = fakeBackend(200, { ...DEADLINES, remembered: true, expiresAt: '2026-10-29T12:00:00.000Z' }, SESSION_HEADER);
    const response = await proxyLogin(login({ body: { ...LOGIN, rememberMe: true } }), {
      env,
      fetchImpl: backend.fetchImpl,
      now: () => NOW,
      log: silent,
    });
    expect(response.headers.get('set-cookie')).toContain(`Max-Age=${REMEMBERED_COOKIE_MAX_AGE_SECONDS}`);
  });

  test.each([
    ['a missing Origin', { headers: { origin: '' } }],
    ['a foreign Origin', { headers: { origin: 'https://evil.test' } }],
    ['a repeated Origin', { headers: { origin: 'http://app.test, http://app.test' } }],
    ['a cross-site fetch', { headers: { 'sec-fetch-site': 'cross-site' } }],
    ['a form post', { headers: { 'content-type': 'application/x-www-form-urlencoded' } }],
  ])('refuses %s before any upstream call (login CSRF)', async (_label, init) => {
    const backend = fakeBackend(200, DEADLINES, SESSION_HEADER);
    const response = await proxyLogin(login(init), { env, fetchImpl: backend.fetchImpl, log: silent });
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(backend.calls).toHaveLength(0);
  });

  test.each([
    ['an extra field', { ...LOGIN, accountId: 'x' }],
    ['a string remember me', { ...LOGIN, rememberMe: 'true' }],
    ['an empty password', { ...LOGIN, password: '' }],
    ['an oversized password', { ...LOGIN, password: 'x'.repeat(257) }],
  ])('refuses %s with 400 before any upstream call', async (_label, body) => {
    const backend = fakeBackend(200, DEADLINES, SESSION_HEADER);
    const response = await proxyLogin(login({ body }), { env, fetchImpl: backend.fetchImpl, log: silent });
    expect(response.status).toBe(400);
    expect(backend.calls).toHaveLength(0);
  });

  test.each([
    [401, 401, 'Authentication is required.'],
    [429, 429, 'Too many requests.'],
    [400, 400, 'Invalid request.'],
    [500, 503, 'Service is temporarily unavailable.'],
    [0, 503, 'Service is temporarily unavailable.'],
  ])('translates upstream %i into a generic %i without retry', async (upstream, status, message) => {
    const backend =
      upstream === 0
        ? {
            calls: [] as unknown[],
            fetchImpl: (async () => {
              backend.calls.push(1);
              throw new Error('down');
            }) as unknown as typeof fetch,
          }
        : fakeBackend(upstream, { reason: 'suspended', accountId: 'x' }, { 'retry-after': '37' });
    const response = await proxyLogin(login(), { env, fetchImpl: backend.fetchImpl, log: silent });
    expect(response.status).toBe(status);
    expect(await json(response)).toEqual({ data: {}, message, statusCode: status });
    expect(response.headers.get('retry-after')).toBeNull();
    expect(backend.calls).toHaveLength(1);
  });

  test('a success without a token or with an unknown shape is a 502 and sets nothing', async () => {
    for (const backend of [fakeBackend(200, DEADLINES), fakeBackend(200, { authenticated: true }, SESSION_HEADER)]) {
      const response = await proxyLogin(login(), { env, fetchImpl: backend.fetchImpl, log: silent });
      expect(response.status).toBe(502);
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  });

  test('is hidden while AUTH_UI_ENABLED is off', async () => {
    const backend = fakeBackend(200, DEADLINES, SESSION_HEADER);
    const response = await proxyLogin(login(), { env: testEnv({ AUTH_UI_ENABLED: false }), fetchImpl: backend.fetchImpl, log: silent });
    expect(response.status).toBe(404);
    expect(backend.calls).toHaveLength(0);
  });

  test('logs an allowlist only', async () => {
    const lines: string[] = [];
    await proxyLogin(login(), { env, fetchImpl: fakeBackend(401).fetchImpl, log: (line) => lines.push(line) });
    expect(Object.keys(JSON.parse(lines[0]!))).toEqual(['scope', 'operation', 'status', 'durationMs', 'correlationId']);
    expect(lines.join()).not.toContain('ana@example.test');
  });
});

describe('GET /api/auth/session (maintenance)', () => {
  const env = testEnv();
  const request = (headers: Record<string, string> = {}, cookie = `eventmatch_session=${TOKEN}`) =>
    new Request('http://app.test/api/auth/session', { headers: { cookie, 'sec-fetch-site': 'same-origin', ...headers } });

  test('asks the backend to rotate and swaps the cookie without exposing the new token', async () => {
    const backend = fakeBackend(
      200,
      { ...DEADLINES, remembered: true, expiresAt: '2026-10-20T12:00:00.000Z', rotationDue: false },
      { 'x-eventmatch-session': ROTATED },
    );
    const response = await proxySessionMaintenance(request(), { env, fetchImpl: backend.fetchImpl, now: () => NOW, log: silent });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(ROTATED);
    expect(response.headers.get('set-cookie')).toBe(
      `eventmatch_session=${ROTATED}; Path=/; Max-Age=${21 * 24 * 3600}; HttpOnly; SameSite=Lax`,
    );
    expect(backend.calls[0]?.url).toBe('http://backend.test/api/v1/auth/session?capability=authenticated_home&rotate=true');
    expect(backend.calls[0]?.init.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  test('keeps the cookie untouched when nothing rotated', async () => {
    const backend = fakeBackend(200, { ...DEADLINES, rotationDue: false });
    const response = await proxySessionMaintenance(request(), { env, fetchImpl: backend.fetchImpl, log: silent });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  test('401 expires the cookie; 403 keeps it; 5xx neither extends nor drops it', async () => {
    const expired = expiredSessionCookie(env);
    const unauthorized = await proxySessionMaintenance(request(), { env, fetchImpl: fakeBackend(401).fetchImpl, log: silent });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('set-cookie')).toBe(expired);

    const forbidden = await proxySessionMaintenance(request(), { env, fetchImpl: fakeBackend(403).fetchImpl, log: silent });
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.get('set-cookie')).toBeNull();

    const failing = await proxySessionMaintenance(request(), { env, fetchImpl: fakeBackend(500).fetchImpl, log: silent });
    expect(failing.status).toBe(503);
    expect(failing.headers.get('set-cookie')).toBeNull();
  });

  test('without a cookie answers 401 without calling upstream; cross-site triggers are refused', async () => {
    const backend = fakeBackend(200, { ...DEADLINES, rotationDue: false });
    expect((await proxySessionMaintenance(request({}, ''), { env, fetchImpl: backend.fetchImpl, log: silent })).status).toBe(401);
    expect(
      (await proxySessionMaintenance(request({ 'sec-fetch-site': 'cross-site' }), { env, fetchImpl: backend.fetchImpl, log: silent }))
        .status,
    ).toBe(403);
    expect(backend.calls).toHaveLength(0);
  });

  test('a registration continuation never authenticates here', async () => {
    const backend = fakeBackend(200, { ...DEADLINES, rotationDue: false });
    const response = await proxySessionMaintenance(request({}, `eventmatch_registration=${TOKEN}`), {
      env,
      fetchImpl: backend.fetchImpl,
      log: silent,
    });
    expect(response.status).toBe(401);
    expect(backend.calls).toHaveLength(0);
  });
});

describe('POST /api/auth/logout', () => {
  const env = testEnv();
  const logout = (cookie?: string, headers: Record<string, string> = {}) =>
    browserRequest('/api/auth/logout', { body: {}, cookie, headers });

  test.each([
    ['revoked upstream', 200, { loggedOut: true }],
    ['already gone upstream', 401, {}],
  ])('always expires the cookie when %s', async (_label, status, data) => {
    const backend = fakeBackend(status, data);
    const response = await proxyLogout(logout(`eventmatch_session=${TOKEN}`), { env, fetchImpl: backend.fetchImpl, log: silent });
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ data: { loggedOut: true } });
    expect(response.headers.get('set-cookie')).toBe(expiredSessionCookie(env));
    expect(backend.calls[0]?.init.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  test('an unavailable backend still expires the local cookie', async () => {
    const response = await proxyLogout(logout(`eventmatch_session=${TOKEN}`), { env, fetchImpl: fakeBackend(503).fetchImpl, log: silent });
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBe(expiredSessionCookie(env));
  });

  test('without a cookie answers logged out without calling upstream, even with the UI flag off', async () => {
    const backend = fakeBackend(200, { loggedOut: true });
    const response = await proxyLogout(logout(), { env: testEnv({ AUTH_UI_ENABLED: false }), fetchImpl: backend.fetchImpl, log: silent });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBe(expiredSessionCookie(env));
    expect(backend.calls).toHaveLength(0);
  });

  test('refuses a cross-origin logout', async () => {
    const backend = fakeBackend(200, { loggedOut: true });
    const response = await proxyLogout(logout(`eventmatch_session=${TOKEN}`, { origin: 'https://evil.test' }), {
      env,
      fetchImpl: backend.fetchImpl,
      log: silent,
    });
    expect(response.status).toBe(403);
    expect(backend.calls).toHaveLength(0);
  });
});

describe('server-side session view', () => {
  const env = testEnv();

  test.each([
    [200, { ...DEADLINES, rotationDue: false }, 'authenticated'],
    [401, {}, 'anonymous'],
    [403, {}, 'forbidden'],
    [500, {}, 'unavailable'],
    [200, { authenticated: true }, 'unavailable'],
  ] as const)('upstream %i resolves to %s without rotating', async (status, data, view) => {
    const backend = fakeBackend(status, data);
    expect(await resolveSessionView(TOKEN, { env, fetchImpl: backend.fetchImpl })).toBe(view);
    expect(backend.calls[0]?.url).toBe('http://backend.test/api/v1/auth/session?capability=authenticated_home');
  });

  test('no cookie is anonymous without any upstream call', async () => {
    const backend = fakeBackend(200, {});
    expect(await resolveSessionView(undefined, { env, fetchImpl: backend.fetchImpl })).toBe('anonymous');
    expect(backend.calls).toHaveLength(0);
  });
});
