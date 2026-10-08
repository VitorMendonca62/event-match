import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const baseUrl = process.env.E2E_BASE_URL;
const brevoUrl = process.env.E2E_FAKE_BREVO_URL;
const databaseUrl = process.env.E2E_DATABASE_URL;
const bffToken = process.env.E2E_BFF_INTERNAL_TOKEN;
if (!baseUrl || !brevoUrl || !databaseUrl || !bffToken) {
  throw new Error('E2E_BASE_URL, E2E_FAKE_BREVO_URL, E2E_DATABASE_URL and E2E_BFF_INTERNAL_TOKEN are required.');
}

const PASSWORD = 'uma senha longa e rara';
/** The runner shortens the login window to 8 s and the rotation interval to 3 s (test env only). */
const WINDOW_MS = 8_000;
const RENEWAL_MS = 3_000;

interface Reply {
  status: number;
  text: string;
  body: { data: Record<string, unknown>; message: string; statusCode: number };
  session: string | null;
  continuation: string | null;
  cacheControl: string | null;
}

/** Plays the Next.js BFF: internal token, origin fingerprint and session token kept server-side. */
async function call(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; continuation?: string; key?: boolean; fingerprint?: string; bff?: string } = {},
): Promise<Reply> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-eventmatch-bff-token': options.bff ?? bffToken!,
  };
  const bearer = options.token ?? options.continuation;
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (options.key) headers['idempotency-key'] = randomUUID();
  if (options.fingerprint) headers['x-eventmatch-origin-fingerprint'] = options.fingerprint;
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: JSON.parse(text) as Reply['body'],
    session: response.headers.get('x-eventmatch-session'),
    continuation: response.headers.get('x-registration-continuation'),
    cacheControl: response.headers.get('cache-control'),
  };
}

const fingerprint = () => randomBytes(32).toString('base64url');
const unique = (label: string) => `${label}-${randomBytes(4).toString('hex')}@example.test`;
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function lastOtp(address: string): Promise<string> {
  const messages = (await (await fetch(new URL('/__messages', brevoUrl))).json()) as { to: string[]; text: string }[];
  const otp = messages.filter((message) => message.to.includes(address)).at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
  if (!otp) throw new Error('no OTP delivered');
  return otp;
}

/** Creates an active account through the real registration contract, exactly as a person would. */
async function activeAccount(contact: string): Promise<void> {
  let continuation = (await call('POST', '/api/v1/registration/eligibility', { body: { birthDate: '1990-05-10' } })).continuation;
  const requested = await call('POST', '/api/v1/registration/contact-verification', {
    continuation: continuation!,
    key: true,
    fingerprint: fingerprint(),
    body: { channel: 'email', contact },
  });
  expect(requested.status).toBe(202);
  const confirmed = await call('POST', '/api/v1/registration/contact-verification/confirm', {
    continuation: continuation!,
    key: true,
    body: { otp: await lastOtp(contact) },
  });
  continuation = confirmed.continuation;
  const password = await call('PUT', '/api/v1/registration/password', {
    continuation: continuation!,
    key: true,
    body: { password: PASSWORD, passwordConfirmation: PASSWORD },
  });
  const required = await call('PUT', '/api/v1/registration/required-data', {
    continuation: password.continuation!,
    key: true,
    body: { displayName: 'Ana', region: 'Recife - PE', usageIntents: ['friendship'] },
  });
  const documents = await call('GET', '/api/v1/registration/legal-documents?locale=pt-BR');
  const documentIds = (documents.body.data.documents as { id: string }[]).map((document) => document.id);
  if (documentIds.length !== 3) throw new Error('the E2E database must hold the three approved legal documents');
  const interests = (await (await fetch(new URL('/api/v1/catalog/interests?locale=pt-BR', baseUrl))).json()) as {
    data: { interests: { id: string }[] };
  };
  const complete = await call('POST', '/api/v1/registration/complete', {
    continuation: required.continuation!,
    key: true,
    body: { birthDate: '1990-05-10', documentIds, interestIds: interests.data.interests.slice(0, 3).map((i) => i.id) },
  });
  expect(complete.body.data).toEqual({ status: 'active' });
}

const login = (email: string, options: { password?: string; rememberMe?: boolean; origin?: string } = {}) =>
  call('POST', '/api/v1/auth/login', {
    fingerprint: options.origin ?? fingerprint(),
    body: { email, password: options.password ?? PASSWORD, rememberMe: options.rememberMe ?? false },
  });

describe('Auth API v1 (e2e, container)', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const ana = unique('ana');

  beforeAll(async () => {
    await activeAccount(ana);
  }, 30_000);

  afterAll(async () => {
    await pool.end();
  });

  test('BFF token, flag, methods, DTOs, Swagger and no-store', async () => {
    const without = await call('POST', '/api/v1/auth/login', {
      bff: 'x',
      fingerprint: fingerprint(),
      body: { email: ana, password: PASSWORD, rememberMe: false },
    });
    expect(without.status).toBe(401);
    expect(without.cacheControl).toBe('no-store');
    expect((await call('GET', '/api/v1/auth/login')).status).toBe(404);
    expect((await call('POST', '/api/v1/auth/login', { fingerprint: fingerprint(), body: { email: ana } })).status).toBe(400);

    const document = (await (await fetch(new URL('/docs-json', baseUrl))).json()) as {
      info: { version: string };
      paths: Record<string, unknown>;
    };
    expect(document.info.version).toBe('0.16.0');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/api/v1/auth/login', '/api/v1/auth/session', '/api/v1/auth/logout']),
    );
  });

  test('login → session → logout → the old bearer is refused; the token never reaches a body', async () => {
    const logged = await login(ana);
    expect(logged.status).toBe(200);
    expect(logged.cacheControl).toBe('no-store');
    expect(logged.body.data).toMatchObject({ authenticated: true, remembered: false });
    const token = logged.session!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(logged.text).not.toContain(token);

    const session = await call('GET', '/api/v1/auth/session', { token });
    expect(session.status).toBe(200);
    expect(session.body.data).toMatchObject({ authenticated: true, rotationDue: false });
    expect(session.text).not.toContain(ana);

    const stored = await pool.query<{ digest: string }>(`select encode(token_digest, 'base64') as digest from authenticated_session`);
    expect(JSON.stringify(stored.rows)).not.toContain(token);

    expect((await call('POST', '/api/v1/auth/logout', { token })).body).toEqual({
      data: { loggedOut: true },
      message: 'Sessão encerrada.',
      statusCode: 200,
    });
    expect((await call('GET', '/api/v1/auth/session', { token })).status).toBe(401);
    expect((await call('POST', '/api/v1/auth/logout', { token })).status).toBe(200);
  });

  test('profile endpoints authorize the owner, isolate accounts and preserve optimistic concurrency', async () => {
    const bia = unique('bia-perfil');
    await activeAccount(bia);
    const [anaLogin, biaLogin] = await Promise.all([login(ana), login(bia)]);
    const anaToken = anaLogin.session!;
    const biaToken = biaLogin.session!;
    expect((await call('GET', '/api/v1/profiles/me')).status).toBe(401);

    const anaProfile = await call('GET', '/api/v1/profiles/me', { token: anaToken });
    const biaProfile = await call('GET', '/api/v1/profiles/me', { token: biaToken });
    expect(anaProfile.status).toBe(200);
    expect(biaProfile.status).toBe(200);
    const interests = (anaProfile.body.data.interests as { id: string }[]).map(({ id }) => id);
    const update = {
      revision: anaProfile.body.data.revision,
      displayName: 'Ana do perfil',
      region: anaProfile.body.data.region,
      usageIntents: anaProfile.body.data.usageIntents,
      interestIds: interests,
      presentation: 'Atividades culturais em grupo.',
      photoVisibility: 'private',
      presentationVisibility: 'authenticated',
      pronounSelection: 'ela_dela',
      customPronouns: null,
      pronounsVisibility: 'authenticated',
      profession: 'Produtora cultural',
      professionVisibility: 'authenticated',
      languageCodes: ['pt', 'bzs'],
      languagesVisibility: 'authenticated',
      activityPreferenceCodes: ['small_group', 'outdoor'],
      activityPreferencesVisibility: 'authenticated',
      availabilitySlots: ['fri_evening', 'sat_early_hours'],
      preferredDistance: 'up_to_5km',
      socialLinks: [],
    };
    const { activityPreferenceCodes: _omittedCodes, ...withoutPreferences } = update;
    void _omittedCodes;
    const invalidCases = [
      { ...update, languageCodes: ['pt', 'en', 'es', 'bzs', 'fr', 'it'] },
      { ...update, languageCodes: ['pt', 'pt'] },
      { ...update, pronounSelection: 'other', customPronouns: null },
      { ...update, pronounsVisibility: 'public' },
      withoutPreferences,
      { ...update, activityPreferenceCodes: ['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group', 'medium_group'] },
      { ...update, activityPreferenceCodes: ['Small-Group'] },
      { ...update, activityPreferencesVisibility: 'public' },
    ];
    for (const body of invalidCases) expect((await call('PUT', '/api/v1/profiles/me', { token: anaToken, body })).status).toBe(400);
    const unknownLanguage = await call('PUT', '/api/v1/profiles/me', { token: anaToken, body: { ...update, languageCodes: ['pt', 'xx'] } });
    expect(unknownLanguage.status).toBe(422);
    expect(unknownLanguage.body).toMatchObject({ statusCode: 422, data: { reason: 'unknown_language' } });
    const unknownPreference = await call('PUT', '/api/v1/profiles/me', { token: anaToken, body: { ...update, activityPreferenceCodes: ['rooftop_party'] } });
    expect(unknownPreference.status).toBe(422);
    expect(unknownPreference.body).toMatchObject({ statusCode: 422, data: { reason: 'unknown_activity_preference' } });
    expect(JSON.stringify(unknownPreference.body)).not.toContain('rooftop_party');
    expect((await call('GET', '/api/v1/profiles/me', { token: anaToken })).body.data).toMatchObject({ revision: update.revision, languages: [], activityPreferences: [], activityPreferencesVisibility: 'private' });
    const saved = await call('PUT', '/api/v1/profiles/me', { token: anaToken, body: update });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ displayName: 'Ana do perfil', revision: Number(update.revision) + 1, activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre', active: true }, { code: 'small_group', label: 'Grupo pequeno', active: true }] });
    expect((await call('PUT', '/api/v1/profiles/me', { token: anaToken, body: update })).status).toBe(409);

    const preview = await call('GET', '/api/v1/profiles/me/preview', { token: anaToken });
    expect(preview.body.data).toMatchObject({ displayName: 'Ana do perfil', presentation: 'Atividades culturais em grupo.', pronouns: 'Ela/dela', profession: 'Produtora cultural', languages: [{ code: 'pt', label: 'Português' }, { code: 'bzs', label: 'Libras' }], activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre' }, { code: 'small_group', label: 'Grupo pequeno' }] });
    expect(JSON.stringify(preview.body.data)).not.toMatch(/accountId|birthDate|contact|session/i);
    const hidden = await call('PUT', '/api/v1/profiles/me', { token: anaToken, body: { ...update, revision: saved.body.data.revision, activityPreferencesVisibility: 'private' } });
    expect(hidden.status).toBe(200);
    expect((await call('GET', '/api/v1/profiles/me/preview', { token: anaToken })).body.data).not.toHaveProperty('activityPreferences');
    const catalog = await call('GET', '/api/v1/catalog/activity-preferences?locale=pt-BR');
    expect(catalog.status).toBe(200);
    expect(catalog.cacheControl).toBe('no-store');
    expect((catalog.body.data.activityPreferences as { code: string }[]).map(({ code }) => code)).toEqual(['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group', 'medium_group', 'light_physical_activity', 'moderate_physical_activity', 'cultural_experience', 'conversation_and_socializing', 'structured_activity', 'spontaneous_activity']);
    const biaAfter = await call('GET', '/api/v1/profiles/me', { token: biaToken });
    expect(biaAfter.body.data.displayName).toBe('Ana');
  }, 30_000);

  test('profile photo grant, finalize and removal run end to end with the local fake provider', async () => {
    const logged = await login(ana);
    const token = logged.session!;
    const before = await call('GET', '/api/v1/profiles/me', { token });
    const grant = await call('POST', '/api/v1/profiles/me/photo/uploads', {
      token,
      fingerprint: fingerprint(),
      body: { revision: before.body.data.revision },
    });
    expect(grant.status).toBe(201);
    expect(grant.body.data).toMatchObject({ cloudName: 'fixture', apiKey: 'fixture-public-key' });
    expect(JSON.stringify(grant.body.data)).not.toMatch(/api_secret|secret/i);

    const finalized = await call('POST', `/api/v1/profiles/me/photo/uploads/${String(grant.body.data.uploadId)}/finalize`, {
      token,
      body: {
        revision: before.body.data.revision,
        providerResponse: {
          asset_id: 'fixture-asset',
          public_id: grant.body.data.publicId,
          version: 1,
          signature: 'fixture-response-signature',
          format: 'webp',
          bytes: 1024,
          width: 512,
          height: 512,
        },
      },
    });
    expect(finalized.status).toBe(200);
    expect(finalized.body.data.photo).toMatchObject({ width: 512, height: 512 });
    expect(String((finalized.body.data.photo as Record<string, unknown>).deliveryUrl)).toContain('media.example.test');

    const removed = await call('DELETE', '/api/v1/profiles/me/photo', {
      token,
      body: { revision: finalized.body.data.revision },
    });
    expect(removed.status).toBe(200);
    expect(removed.body.data.photo).toBeNull();
  }, 30_000);

  test('unknown contact, wrong password and forbidden states answer the same 401 snapshot', async () => {
    const suspended = unique('suspensa');
    await activeAccount(suspended);
    // The account just activated is the most recent one; tests in this file run sequentially.
    await pool.query(
      `update account set status = 'suspended'
       where id = (select id from account where status = 'active' order by activated_at desc limit 1)`,
    );
    const replies = await Promise.all([
      login(unique('ninguem')),
      login(ana, { password: 'outra senha qualquer' }),
      login(suspended),
    ]);
    for (const reply of replies) {
      expect(reply.status).toBe(401);
      expect(reply.session).toBeNull();
      expect(reply.text).toBe(replies[0]!.text);
    }
    expect(replies[0]!.body).toEqual({ data: {}, message: 'Authentication is required.', statusCode: 401 });
  });

  test('the contact bucket answers a generic 429 and recovers by itself', async () => {
    await sleep(WINDOW_MS + 500); // earlier tests left failures for this contact in the window
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(ana, { password: 'errada' })).status).toBe(401);
    }
    const limited = await login(ana);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ data: {}, message: 'Too many requests.', statusCode: 429 });
    await sleep(WINDOW_MS + 500);
    expect((await login(ana)).status).toBe(200);
  }, 30_000);

  test('the origin bucket limits every contact behind one origin', async () => {
    const origin = fingerprint();
    // Concurrent on purpose: the bucket must stay exact, and the burst fits well inside the window.
    const burst = await Promise.all(Array.from({ length: 30 }, () => login(unique('varredura'), { origin })));
    expect(burst.map((reply) => reply.status)).toEqual(Array.from({ length: 30 }, () => 401));
    expect((await login(ana, { origin })).status).toBe(429);
    await sleep(WINDOW_MS + 500);
    expect((await login(ana, { origin })).status).toBe(200);
  }, 30_000);

  test('a remembered session rotates only through the internal header, never in a body', async () => {
    const logged = await login(ana, { rememberMe: true });
    const token = logged.session!;
    await sleep(RENEWAL_MS + 200);

    const reported = await call('GET', '/api/v1/auth/session', { token });
    expect(reported.body.data).toMatchObject({ remembered: true, rotationDue: true });
    expect(reported.session).toBeNull();

    const rotated = await call('GET', '/api/v1/auth/session?rotate=true', { token });
    expect(rotated.session).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rotated.session).not.toBe(token);
    expect(rotated.text).not.toContain(rotated.session!);
    expect(rotated.body.data.expiresAt).toBe(reported.body.data.expiresAt);

    expect((await call('GET', '/api/v1/auth/session', { token: rotated.session! })).status).toBe(200);
    await sleep(2_200);
    expect((await call('GET', '/api/v1/auth/session', { token })).status).toBe(401);
  }, 30_000);
});
