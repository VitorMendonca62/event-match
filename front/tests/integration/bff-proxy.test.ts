import { describe, expect, test } from 'bun:test';

import { proxyRegistration } from '../../src/shared/server/bff-proxy';
import { REGISTRATION_OPERATIONS as OPS } from '../../src/shared/server/registration-operations';
import { browserRequest, fakeBackend, KEY, ROTATED, SECRET, TOKEN, testEnv } from './bff-fixtures';

const env = testEnv();
const cookie = `eventmatch_registration=${TOKEN}`;
const silent = () => {};

describe('registration BFF proxy', () => {
  test('forwards a valid command once with internal headers and stores the rotated continuation', async () => {
    const backend = fakeBackend(200, { stage: 'registration_in_progress', expiresAt: '2099-01-01T00:00:00.000Z' }, {
      'X-Registration-Continuation': ROTATED,
    });
    const response = await proxyRegistration(
      browserRequest('/api/registration/password', {
        method: 'PUT',
        body: { password: 'uma frase longa', passwordConfirmation: 'uma frase longa' },
        cookie,
      }),
      OPS.password,
      { env, fetchImpl: backend.fetchImpl, log: silent },
    );

    expect(response.status).toBe(200);
    expect(backend.calls).toHaveLength(1);
    const { url, init } = backend.calls[0]!;
    expect(url).toBe('http://backend.test/api/v1/registration/password');
    expect(init.method).toBe('PUT');
    expect(init.cache).toBe('no-store');
    expect(init.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(init.headers.get('x-eventmatch-bff-token')).toBe(SECRET);
    expect(init.headers.get('idempotency-key')).toBe(KEY);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`eventmatch_registration=${ROTATED}`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-registration-continuation')).toBeNull();
    const body = await response.text();
    expect(body).not.toContain(ROTATED);
    expect(body).not.toContain(SECRET);
  });

  test('refuses foreign, missing or repeated origins and wrong content types without calling upstream', async () => {
    const cases: Record<string, string>[] = [
      { origin: 'https://evil.test' },
      { origin: '' },
      { origin: 'http://app.test, http://app.test' },
      { 'content-type': 'text/plain' },
      { 'sec-fetch-site': 'cross-site' },
    ];
    for (const headers of cases) {
      const backend = fakeBackend(200, { eligible: true });
      const request = browserRequest('/api/registration/eligibility', { body: { birthDate: '1990-05-10' }, headers });
      if (headers.origin === '') request.headers.delete('origin');
      const response = await proxyRegistration(request, OPS.eligibility, { env, fetchImpl: backend.fetchImpl, log: silent });
      expect(response.status).toBe(403);
      expect(backend.calls).toHaveLength(0);
    }
  });

  test('rejects bodies outside the contract and malformed idempotency keys before upstream', async () => {
    const backend = fakeBackend(200, { eligible: true });
    const extra = await proxyRegistration(
      browserRequest('/api/registration/eligibility', { body: { birthDate: '1990-05-10', contact: 'a@example.test' } }),
      OPS.eligibility,
      { env, fetchImpl: backend.fetchImpl, log: silent },
    );
    const badKey = await proxyRegistration(
      browserRequest('/api/registration/eligibility', { body: { birthDate: '1990-05-10' }, headers: { 'idempotency-key': 'short' } }),
      OPS.eligibility,
      { env, fetchImpl: backend.fetchImpl, log: silent },
    );
    expect(extra.status).toBe(400);
    expect(badKey.status).toBe(400);
    expect(await extra.text()).not.toContain('a@example.test');
    expect(backend.calls).toHaveLength(0);
  });

  test('a command without continuation answers 401 and expires the cookie', async () => {
    const backend = fakeBackend(200);
    const response = await proxyRegistration(
      browserRequest('/api/registration/contact-verification/confirm', { body: { otp: '123456' } }),
      OPS.confirmContact,
      { env, fetchImpl: backend.fetchImpl, log: silent },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(backend.calls).toHaveLength(0);
  });

  test('an upstream 401 expires the cookie; completion expires it on success', async () => {
    const expired = await proxyRegistration(
      browserRequest('/api/registration/resend', { body: {}, cookie }),
      OPS.resendVerification,
      { env, fetchImpl: fakeBackend(401).fetchImpl, log: silent },
    );
    expect(expired.status).toBe(401);
    expect(expired.headers.get('set-cookie')).toContain('Max-Age=0');

    const completed = await proxyRegistration(
      browserRequest('/api/registration/complete', {
        body: {
          birthDate: '1990-05-10',
          documentIds: ['0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f51'],
          interestIds: ['0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f52'],
        },
        cookie,
      }),
      OPS.complete,
      { env, fetchImpl: fakeBackend(200, { status: 'active' }).fetchImpl, log: silent },
    );
    expect(completed.status).toBe(200);
    expect(completed.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  test('translates errors conservatively: public 422 reasons only, 5xx and timeouts become 503', async () => {
    const weak = await proxyRegistration(
      browserRequest('/api/registration/password', {
        method: 'PUT',
        body: { password: 'uma frase longa', passwordConfirmation: 'uma frase longa' },
        cookie,
      }),
      OPS.password,
      { env, fetchImpl: fakeBackend(422, { reason: 'weak_password' }).fetchImpl, log: silent },
    );
    expect(await weak.json()).toMatchObject({ statusCode: 422, data: { reason: 'weak_password' } });

    const leaky = await proxyRegistration(
      browserRequest('/api/registration/password', {
        method: 'PUT',
        body: { password: 'uma frase longa', passwordConfirmation: 'uma frase longa' },
        cookie,
      }),
      OPS.password,
      { env, fetchImpl: fakeBackend(422, { reason: 'contact_exists', detail: 'x' }).fetchImpl, log: silent },
    );
    expect((await leaky.json()).data).toEqual({});

    const failing = await proxyRegistration(
      browserRequest('/api/registration/eligibility', { body: { birthDate: '1990-05-10' } }),
      OPS.eligibility,
      { env, fetchImpl: fakeBackend(500).fetchImpl, log: silent },
    );
    expect(failing.status).toBe(503);

    let attempts = 0;
    const offline = (async () => {
      attempts += 1;
      throw new DOMException('timeout', 'TimeoutError');
    }) as unknown as typeof fetch;
    const timedOut = await proxyRegistration(
      browserRequest('/api/registration/eligibility', { body: { birthDate: '1990-05-10' } }),
      OPS.eligibility,
      { env, fetchImpl: offline, log: silent },
    );
    expect(timedOut.status).toBe(503);
    expect(attempts).toBe(1);
  });

  test('neutral contact request carries the fingerprint and returns the same shape', async () => {
    const backend = fakeBackend(202, { expiresAt: '2099-01-01T00:15:00.000Z', nextResendAt: '2099-01-01T00:01:00.000Z' });
    const response = await proxyRegistration(
      browserRequest('/api/registration/contact-verification', {
        body: { channel: 'email', contact: 'pessoa@example.test' },
        cookie,
      }),
      OPS.requestVerification,
      { env, fetchImpl: backend.fetchImpl, log: silent },
    );
    expect(response.status).toBe(202);
    expect(backend.calls[0]!.init.headers.get('x-eventmatch-origin-fingerprint')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Object.keys((await response.json()).data).sort()).toEqual(['expiresAt', 'nextResendAt']);
  });

  test('logs only operation, status, duration and correlation id', async () => {
    const lines: string[] = [];
    await proxyRegistration(
      browserRequest('/api/registration/contact-verification', {
        body: { channel: 'email', contact: 'pessoa@example.test' },
        cookie,
      }),
      OPS.requestVerification,
      { env, fetchImpl: fakeBackend(202, { expiresAt: '2099-01-01T00:15:00.000Z', nextResendAt: '2099-01-01T00:01:00.000Z' }).fetchImpl, log: (line) => lines.push(line) },
    );
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(Object.keys(entry).sort()).toEqual(['correlationId', 'durationMs', 'operation', 'scope', 'status']);
    expect(lines[0]).not.toContain('pessoa@example.test');
    expect(lines[0]).not.toContain(TOKEN);
  });

  test('public catalog is proxied without the internal credential or continuation', async () => {
    const backend = fakeBackend(200, { interests: [] });
    const response = await proxyRegistration(
      new Request('http://app.test/api/catalog/interests', { headers: { cookie } }),
      OPS.interests,
      { env, fetchImpl: backend.fetchImpl, log: silent },
    );
    expect(response.status).toBe(200);
    expect(backend.calls[0]!.url).toBe('http://backend.test/api/v1/catalog/interests?locale=pt-BR');
    expect(backend.calls[0]!.init.headers.get('x-eventmatch-bff-token')).toBeNull();
    expect(backend.calls[0]!.init.headers.get('authorization')).toBeNull();
  });
});
