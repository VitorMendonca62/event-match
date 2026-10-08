import { describe, expect, test } from 'bun:test';
import { proxyPhotoMutation, proxyProfile, proxyProfileInvitationDismiss } from '../../src/shared/server/profile-bff';
import { browserRequest, fakeBackend, SECRET, TOKEN, testEnv } from './bff-fixtures';

const interestIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const profile = {
  revision: 1, displayName: 'Ana', location: { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife' }, usageIntents: ['friendship'],
  interests: interestIds.map((id, index) => ({ id, slug: `interest-${index}`, label: `Interesse ${index}` })),
  presentation: null, photoVisibility: 'private', presentationVisibility: 'private', photo: null,
  pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null,
  professionVisibility: 'private', languages: [], languagesVisibility: 'private',
  activityPreferences: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null, socialLinks: [],
  completion: { complete: false, completedCount: 4, totalCount: 6, missing: ['photo', 'presentation'] },
  invitationSubject: `v1.${'A'.repeat(43)}`,
};
const cookie = `eventmatch_session=${TOKEN}`;

describe('profile BFF (ADR-038..040)', () => {
  test('GET strips the invitation subject and forwards one authenticated internal request', async () => {
    const backend = fakeBackend(200, profile); const request = browserRequest('/api/profile', { method: 'GET', cookie, body: undefined });
    const result = await proxyProfile(request, { env: testEnv(), fetchImpl: backend.fetchImpl }); const text = await result.text();
    expect(result.status).toBe(200); expect(text).not.toContain('invitationSubject'); expect(text).not.toContain(profile.invitationSubject); expect(backend.calls).toHaveLength(1);
    expect(backend.calls[0]?.init.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
  });
  test('PUT rejects foreign origin before upstream and preserves a conflict', async () => {
  const body = { revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null, socialLinks: [] };
    const backend = fakeBackend(409);
    const foreign = browserRequest('/api/profile', { method: 'PUT', cookie, body, headers: { origin: 'https://evil.test' } });
    expect((await proxyProfile(foreign, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(403); expect(backend.calls).toHaveLength(0);
    expect((await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(409);
  });
  test('PUT forwards canonicalization input and rejects public social visibility at the BFF boundary', async () => {
  const body = { revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null, socialLinks: [{ provider: 'instagram', identifierOrUrl: 'https://www.instagram.com/Ana.Exemplo', position: 1, visibility: 'authenticated' }] };
    const { invitationSubject: _, ...saved } = profile;
    const backend = fakeBackend(200, saved);
    const result = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: backend.fetchImpl });
    expect(result.status).toBe(200);
    expect(JSON.parse(String(backend.calls[0]?.init.body))).toMatchObject({ socialLinks: body.socialLinks });
    const invalid = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body: { ...body, socialLinks: [{ ...body.socialLinks[0], visibility: 'public' }] } }), { env: testEnv(), fetchImpl: fakeBackend(200, profile).fetchImpl });
    expect(invalid.status).toBe(400);
  });
  test('photo grant rejects an unknown response shape instead of exposing it', async () => {
    const backend = fakeBackend(201, { api_secret: 'never', uploadId: crypto.randomUUID() });
    const result = await proxyPhotoMutation(browserRequest('/api/profile/photo/uploads', { cookie, body: { revision: 1 }, headers: { 'x-vercel-forwarded-for': '203.0.113.1' } }), 'grant', undefined, { env: testEnv(), fetchImpl: backend.fetchImpl });
    expect(result.status).toBe(503); expect(await result.text()).not.toContain('api_secret');
  });
  test('PUT allows only the two documented language reasons on 422', async () => {
    const body = { revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: ['pt'], languagesVisibility: 'private', activityPreferenceCodes: ['small_group'], activityPreferencesVisibility: 'authenticated', availabilitySlots: [], preferredDistance: null, socialLinks: [] };
    const known = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: fakeBackend(422, { reason: 'inactive_language' }).fetchImpl });
    expect(await known.json()).toMatchObject({ data: { reason: 'inactive_language' } });
    const unknown = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: fakeBackend(422, { reason: 'private_detail' }).fetchImpl });
    expect(await unknown.json()).toMatchObject({ data: {} });
  });
  test('PUT forwards activity preferences and only their documented 422 reasons (ADR-044)', async () => {
  const body = { revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: ['small_group', 'outdoor'], activityPreferencesVisibility: 'authenticated', availabilitySlots: ['fri_evening', 'sat_early_hours'], preferredDistance: 'up_to_5km', socialLinks: [] };
    const { invitationSubject: _, ...own } = profile;
    const saved = { ...own, revision: 2, activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre', active: true }, { code: 'small_group', label: 'Grupo pequeno', active: true }], activityPreferencesVisibility: 'authenticated' };
    const backend = fakeBackend(200, saved);
    const ok = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: backend.fetchImpl });
    expect(ok.status).toBe(200);
    expect(JSON.parse(String(backend.calls[0]?.init.body))).toMatchObject({ activityPreferenceCodes: ['small_group', 'outdoor'], activityPreferencesVisibility: 'authenticated', availabilitySlots: ['fri_evening', 'sat_early_hours'], preferredDistance: 'up_to_5km' });
    for (const reason of ['unknown_activity_preference', 'inactive_activity_preference']) {
      const rejected = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: fakeBackend(422, { reason }).fetchImpl });
      expect(await rejected.json()).toMatchObject({ statusCode: 422, data: { reason } });
    }
    const invalid = fakeBackend(200, saved);
    const six = ['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group', 'medium_group'];
    expect((await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body: { ...body, activityPreferenceCodes: six } }), { env: testEnv(), fetchImpl: invalid.fetchImpl })).status).toBe(400);
    const { activityPreferenceCodes: _codes, ...missing } = body;
    expect((await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body: missing }), { env: testEnv(), fetchImpl: invalid.fetchImpl })).status).toBe(400);
    expect(invalid.calls).toHaveLength(0);
    const { availabilitySlots: _slots, ...withoutAvailability } = body;
    expect((await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body: withoutAvailability }), { env: testEnv(), fetchImpl: invalid.fetchImpl })).status).toBe(400);
  });
});

describe('profile invitation dismissal BFF (ADR-040)', () => {
  test('dismisses the invitation with one authenticated upstream call and allowlisted telemetry', async () => {
    const backend = fakeBackend(200, profile);
    const logs: string[] = [];
    const originalInfo = console.info;
    console.info = (...args: unknown[]) => logs.push(args.map(String).join(' '));

    try {
      const result = await proxyProfileInvitationDismiss(
        browserRequest('/api/profile/invitation/dismiss', { cookie }),
        { env: testEnv(), fetchImpl: backend.fetchImpl },
      );
      const text = await result.text();

      expect(result.status).toBe(200);
      expect(JSON.parse(text)).toEqual({ data: {}, message: 'Invitation dismissed.', statusCode: 200 });
      expect(text).not.toContain('invitationSubject');
      expect(text).not.toContain(profile.invitationSubject);
      expect(text).not.toContain(TOKEN);
      expect(result.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(result.headers.get('cache-control')).toBe('no-store');
      expect(result.headers.get('referrer-policy')).toBe('no-referrer');
      expect(result.headers.get('x-content-type-options')).toBe('nosniff');

      const setCookie = result.headers.get('set-cookie');
      expect(setCookie).toContain(`eventmatch_profile_invite=${profile.invitationSubject}.`);
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Max-Age=604800');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).not.toContain('Domain=');
      expect(setCookie).not.toContain('Secure');

      expect(backend.calls).toHaveLength(1);
      expect(backend.calls[0]?.url).toBe('http://backend.test/api/v1/profiles/me');
      expect(backend.calls[0]?.init.method).toBe('GET');
      expect(backend.calls[0]?.init.cache).toBe('no-store');
      expect(backend.calls[0]?.init.redirect).toBe('manual');
      expect(backend.calls[0]?.init.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
      expect(backend.calls[0]?.init.headers.get('x-eventmatch-bff-token')).toBe(SECRET);
      expect(backend.calls[0]?.init.headers.get('cookie')).toBeNull();

      expect(logs).toHaveLength(1);
      const log = JSON.parse(logs[0]!);
      expect(log).toMatchObject({ scope: 'profile-bff', operation: 'profile.invite.dismiss', status: 200 });
      expect(typeof log.durationMs).toBe('number');
      expect(log.correlationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(logs[0]).not.toContain(profile.invitationSubject);
      expect(logs[0]).not.toContain(TOKEN);
      expect(logs[0]).not.toContain('eventmatch_profile_invite');
      expect(logs[0]).not.toContain('displayName');
    } finally {
      console.info = originalInfo;
    }
  });

  test('returns 404 without contacting the backend when the profile UI is disabled', async () => {
    const backend = fakeBackend(200, profile);
    const result = await proxyProfileInvitationDismiss(
      browserRequest('/api/profile/invitation/dismiss', { cookie }),
      { env: testEnv({ PROFILE_UI_ENABLED: false }), fetchImpl: backend.fetchImpl },
    );

    expect(result.status).toBe(404);
    expect(await result.json()).toEqual({ data: {}, message: 'Request failed.', statusCode: 404 });
    expect(result.headers.get('set-cookie')).toBeNull();
    expect(backend.calls).toHaveLength(0);
  });

  test('rejects missing, foreign and repeated origins or non-JSON before contacting the backend', async () => {
    const requests = [
      new Request('http://app.test/api/profile/invitation/dismiss', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
      }),
      browserRequest('/api/profile/invitation/dismiss', { cookie, headers: { origin: 'https://evil.test' } }),
      browserRequest('/api/profile/invitation/dismiss', { cookie, headers: { origin: 'http://app.test, http://app.test' } }),
      browserRequest('/api/profile/invitation/dismiss', { cookie, headers: { 'content-type': 'text/plain' } }),
    ];

    for (const request of requests) {
      const backend = fakeBackend(200, profile);
      const result = await proxyProfileInvitationDismiss(request, { env: testEnv(), fetchImpl: backend.fetchImpl });

      expect(result.status).toBe(403);
      expect(await result.json()).toEqual({ data: {}, message: 'Request failed.', statusCode: 403 });
      expect(result.headers.get('set-cookie')).toBeNull();
      expect(backend.calls).toHaveLength(0);
    }
  });

  test('does not add body parsing to the existing content-type-only validation', async () => {
    const backend = fakeBackend(200, profile);
    const request = new Request('http://app.test/api/profile/invitation/dismiss', {
      method: 'POST',
      headers: { origin: 'http://app.test', 'content-type': 'application/json', cookie },
      body: '{not-json',
    });
    const result = await proxyProfileInvitationDismiss(request, { env: testEnv(), fetchImpl: backend.fetchImpl });

    expect(result.status).toBe(200);
    expect(backend.calls).toHaveLength(1);
  });

  test('expires an absent or malformed session without contacting the backend', async () => {
    for (const sessionCookie of [undefined, 'eventmatch_session=invalid']) {
      const backend = fakeBackend(200, profile);
      const result = await proxyProfileInvitationDismiss(
        browserRequest('/api/profile/invitation/dismiss', { cookie: sessionCookie }),
        { env: testEnv(), fetchImpl: backend.fetchImpl },
      );

      expect(result.status).toBe(401);
      expect(await result.json()).toEqual({ data: {}, message: 'Request failed.', statusCode: 401 });
      expect(result.headers.get('set-cookie')).toBe('eventmatch_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      expect(backend.calls).toHaveLength(0);
    }
  });

  test('maps upstream authentication, authorization and unavailable responses without leaking details', async () => {
    const cases = [
      { status: 401, expectedCookie: 'eventmatch_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' },
      { status: 403, expectedCookie: null },
      { status: 503, expectedCookie: null },
    ] as const;

    for (const current of cases) {
      const backend = fakeBackend(current.status, { secret: 'never' });
      const result = await proxyProfileInvitationDismiss(
        browserRequest('/api/profile/invitation/dismiss', { cookie }),
        { env: testEnv(), fetchImpl: backend.fetchImpl },
      );

      expect(result.status).toBe(current.status);
      expect(await result.json()).toEqual({ data: {}, message: 'Request failed.', statusCode: current.status });
      expect(result.headers.get('set-cookie')).toBe(current.expectedCookie);
      expect(backend.calls).toHaveLength(1);
    }
  });

  test('maps network failures and invalid successful profile shapes to 503', async () => {
    const offline = await proxyProfileInvitationDismiss(
      browserRequest('/api/profile/invitation/dismiss', { cookie }),
      { env: testEnv(), fetchImpl: (async () => { throw new Error('offline'); }) as unknown as typeof fetch },
    );
    expect(offline.status).toBe(503);
    expect(await offline.json()).toEqual({ data: {}, message: 'Request failed.', statusCode: 503 });
    expect(offline.headers.get('set-cookie')).toBeNull();

    const invalidShape = await proxyProfileInvitationDismiss(
      browserRequest('/api/profile/invitation/dismiss', { cookie }),
      { env: testEnv(), fetchImpl: fakeBackend(200, { invitationSubject: 'secret', profile: 'private' }).fetchImpl },
    );
    expect(invalidShape.status).toBe(503);
    expect(await invalidShape.json()).toEqual({ data: {}, message: 'Request failed.', statusCode: 503 });
    expect(invalidShape.headers.get('set-cookie')).toBeNull();
  });
});
