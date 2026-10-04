import { describe, expect, test } from 'bun:test';
import { proxyPhotoMutation, proxyProfile } from '../../src/shared/server/profile-bff';
import { browserRequest, fakeBackend, TOKEN, testEnv } from './bff-fixtures';

const interestIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const profile = {
  revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'],
  interests: interestIds.map((id, index) => ({ id, slug: `interest-${index}`, label: `Interesse ${index}` })),
  presentation: null, photoVisibility: 'private', presentationVisibility: 'private', photo: null,
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
    const body = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private' };
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
});
