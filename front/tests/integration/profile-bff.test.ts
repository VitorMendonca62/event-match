import { describe, expect, test } from 'bun:test';
import { proxyActivityPreferenceCatalog, proxyPhotoMutation, proxyProfile } from '../../src/shared/server/profile-bff';
import { browserRequest, fakeBackend, TOKEN, testEnv } from './bff-fixtures';

const interestIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const profile = {
  revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'],
  interests: interestIds.map((id, index) => ({ id, slug: `interest-${index}`, label: `Interesse ${index}` })),
  presentation: null, photoVisibility: 'private', presentationVisibility: 'private', photo: null,
  pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null,
  professionVisibility: 'private', languages: [], languagesVisibility: 'private',
  activityPreferences: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null,
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
    const body = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null };
    const backend = fakeBackend(409);
    const foreign = browserRequest('/api/profile', { method: 'PUT', cookie, body, headers: { origin: 'https://evil.test' } });
    expect((await proxyProfile(foreign, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(403); expect(backend.calls).toHaveLength(0);
    expect((await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(409);
  });
  test('photo grant rejects an unknown response shape instead of exposing it', async () => {
    const backend = fakeBackend(201, { api_secret: 'never', uploadId: crypto.randomUUID() });
    const result = await proxyPhotoMutation(browserRequest('/api/profile/photo/uploads', { cookie, body: { revision: 1 }, headers: { 'x-vercel-forwarded-for': '203.0.113.1' } }), 'grant', undefined, { env: testEnv(), fetchImpl: backend.fetchImpl });
    expect(result.status).toBe(503); expect(await result.text()).not.toContain('api_secret');
  });
  test('PUT allows only the two documented language reasons on 422', async () => {
    const body = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: ['pt'], languagesVisibility: 'private', activityPreferenceCodes: ['small_group'], activityPreferencesVisibility: 'authenticated', availabilitySlots: [], preferredDistance: null };
    const known = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: fakeBackend(422, { reason: 'inactive_language' }).fetchImpl });
    expect(await known.json()).toMatchObject({ data: { reason: 'inactive_language' } });
    const unknown = await proxyProfile(browserRequest('/api/profile', { method: 'PUT', cookie, body }), { env: testEnv(), fetchImpl: fakeBackend(422, { reason: 'private_detail' }).fetchImpl });
    expect(await unknown.json()).toMatchObject({ data: {} });
  });
  test('PUT forwards activity preferences and only their documented 422 reasons (ADR-044)', async () => {
    const body = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: ['small_group', 'outdoor'], activityPreferencesVisibility: 'authenticated', availabilitySlots: ['fri_evening', 'sat_early_hours'], preferredDistance: 'up_to_5km' };
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
  test('activity preference catalog is public, filtered and fails closed', async () => {
    const backend = fakeBackend(200, { activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre' }] });
    const ok = await proxyActivityPreferenceCatalog({ env: testEnv(), fetchImpl: backend.fetchImpl });
    expect(await ok.json()).toEqual({ data: { activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre' }] }, message: 'Preferências de atividades disponíveis.', statusCode: 200 });
    expect(backend.calls[0]?.url).toBe('http://backend.test/api/v1/catalog/activity-preferences?locale=pt-BR');
    expect(backend.calls[0]?.init.headers.get('x-eventmatch-bff-token')).toBeNull();
    expect(backend.calls[0]?.init.headers.get('authorization')).toBeNull();
    const leaky = await proxyActivityPreferenceCatalog({ env: testEnv(), fetchImpl: fakeBackend(200, { activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre', active: false }] }).fetchImpl });
    expect(leaky.status).toBe(503);
    expect((await proxyActivityPreferenceCatalog({ env: testEnv(), fetchImpl: fakeBackend(400).fetchImpl })).status).toBe(400);
    expect((await proxyActivityPreferenceCatalog({ env: testEnv(), fetchImpl: fakeBackend(500).fetchImpl })).status).toBe(503);
  });
});
