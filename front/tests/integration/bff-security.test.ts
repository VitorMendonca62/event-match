import { describe, expect, test } from 'bun:test';

import { parseBffEnv } from '../../src/shared/config/bff-env.server';
import { confirmEmailLink } from '../../src/shared/server/confirm-link';
import {
  continuationCookieName,
  readContinuationCookie,
  serializeContinuationCookie,
} from '../../src/shared/server/continuation-cookie';
import { resolveOriginFingerprint } from '../../src/shared/server/origin-fingerprint';
import { fakeBackend, ROTATED, SECRET, TOKEN, testEnv } from './bff-fixtures';

const silent = () => {};

describe('continuation cookie', () => {
  test('production uses the __Host- prefix with Secure, HttpOnly and SameSite=Lax', () => {
    const now = new Date('2026-09-26T12:00:00.000Z');
    const cookie = serializeContinuationCookie(TOKEN, '2026-09-26T12:30:00.000Z', { NODE_ENV: 'production' }, now);
    expect(cookie).toBe(`__Host-eventmatch_registration=${TOKEN}; Path=/; Max-Age=1800; HttpOnly; SameSite=Lax; Secure`);
    expect(cookie).not.toContain('Domain');
    expect(continuationCookieName({ NODE_ENV: 'development' })).toBe('eventmatch_registration');
  });

  test('reads only a well-formed token under its own name', () => {
    const env = { NODE_ENV: 'test' as const };
    expect(readContinuationCookie(`a=1; eventmatch_registration=${TOKEN}`, env)).toBe(TOKEN);
    expect(readContinuationCookie('eventmatch_registration=../../etc', env)).toBeUndefined();
    expect(readContinuationCookie(`__Host-eventmatch_registration=${TOKEN}`, env)).toBeUndefined();
  });
});

describe('origin fingerprint', () => {
  const vercel = testEnv({ EDGE_PROVIDER: 'vercel' });

  test('uses only a single, valid x-vercel-forwarded-for and never the raw IP', () => {
    const request = new Request('http://app.test', { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } });
    const fingerprint = resolveOriginFingerprint(request, vercel);
    expect(fingerprint).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fingerprint).not.toContain('203.0.113.7');
    const mapped = new Request('http://app.test', { headers: { 'x-vercel-forwarded-for': '::ffff:203.0.113.7' } });
    expect(resolveOriginFingerprint(mapped, vercel)).toBe(fingerprint);
  });

  test('ignores forged generic headers and rejects lists or invalid values', () => {
    const forged = new Request('http://app.test', {
      headers: { 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.1' },
    });
    expect(resolveOriginFingerprint(forged, vercel)).toBeUndefined();
    const list = new Request('http://app.test', { headers: { 'x-vercel-forwarded-for': '203.0.113.7, 198.51.100.1' } });
    expect(resolveOriginFingerprint(list, vercel)).toBeUndefined();
    const junk = new Request('http://app.test', { headers: { 'x-vercel-forwarded-for': 'not-an-ip' } });
    expect(resolveOriginFingerprint(junk, vercel)).toBeUndefined();
  });
});

describe('e-mail link callback', () => {
  const env = testEnv();

  test('valid link: consumes on the backend, sets the cookie and redirects 303 to a clean URL', async () => {
    const backend = fakeBackend(200, { verified: true }, { 'X-Registration-Continuation': ROTATED });
    const response = await confirmEmailLink(
      new Request(`http://app.test/api/registration/contact-verification/confirm-link?token=${TOKEN}`),
      { env, fetchImpl: backend.fetchImpl, log: silent },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://app.test/cadastro?email-verificado=1');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toContain(ROTATED);
    expect(response.headers.get('location')).not.toContain(TOKEN);
    expect(JSON.parse(String(backend.calls[0]!.init.body))).toEqual({ token: TOKEN });
  });

  test('consumed or malformed link redirects without touching the existing cookie', async () => {
    const consumed = await confirmEmailLink(
      new Request(`http://app.test/cb?token=${TOKEN}`),
      { env, fetchImpl: fakeBackend(200, { verified: false }).fetchImpl, log: silent },
    );
    expect(consumed.headers.get('location')).toBe('http://app.test/cadastro?email-verificado=0');
    expect(consumed.headers.get('set-cookie')).toBeNull();

    const backend = fakeBackend(200, { verified: true });
    const malformed = await confirmEmailLink(new Request('http://app.test/cb?token=short'), {
      env,
      fetchImpl: backend.fetchImpl,
      log: silent,
    });
    expect(malformed.status).toBe(303);
    expect(backend.calls).toHaveLength(0);
  });

  test('the callback log never contains the token', async () => {
    const lines: string[] = [];
    await confirmEmailLink(new Request(`http://app.test/cb?token=${TOKEN}`), {
      env,
      fetchImpl: fakeBackend(200, { verified: false }).fetchImpl,
      log: (line) => lines.push(line),
    });
    expect(lines.join('\n')).not.toContain(TOKEN);
  });
});

describe('BFF configuration', () => {
  const valid = {
    NODE_ENV: 'production',
    BACKEND_INTERNAL_URL: 'http://back:3001',
    FRONTEND_PUBLIC_URL: 'https://eventmatch.example',
    BFF_INTERNAL_TOKEN: SECRET,
    ORIGIN_FINGERPRINT_KEY: SECRET,
    EDGE_PROVIDER: 'vercel',
  };

  test('accepts a complete production configuration', () => {
    expect(parseBffEnv(valid).EDGE_PROVIDER).toBe('vercel');
  });

  test('production refuses fixture origin, plain HTTP and short secrets without echoing values', () => {
    for (const override of [
      { EDGE_PROVIDER: 'fixture' },
      { FRONTEND_PUBLIC_URL: 'http://eventmatch.example' },
      { BFF_INTERNAL_TOKEN: 'c2hvcnQ=' },
    ]) {
      const result = (() => {
        try {
          parseBffEnv({ ...valid, ...override });
          return 'accepted';
        } catch (error) {
          return String(error);
        }
      })();
      expect(result).not.toBe('accepted');
      expect(result).not.toContain('c2hvcnQ=');
    }
  });
});
