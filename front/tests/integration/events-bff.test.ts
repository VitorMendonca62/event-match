import { describe, expect, test } from 'bun:test';

import { browserRequest, fakeBackend, TOKEN, testEnv } from './bff-fixtures';
import { proxyCreateEventDraft, proxyEventDraft, proxyEventPreview, proxyPublishEvent, proxySearchEventLocations } from '../../src/shared/server/events-bff';

const EVENT_ID = '123e4567-e89b-42d3-a456-426614174000';
const cookie = `eventmatch_session=${TOKEN}`;
const ownerDraft = {
  id: EVENT_ID, revision: 2, status: 'draft', activityType: { code: 'caminhada', label: 'Caminhada' },
  title: 'Caminhada no parque', description: 'Encontro informal para caminhar.', startsAtLocal: '2026-11-15T09:00',
  endsAtLocal: null, startsAt: '2026-11-15T12:00:00.000Z', endsAt: null, timeZone: 'America/Recife',
  location: { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife' }, venueType: 'public_place',
  nonResidentialHostDeclaration: true, exactLocation: { latitude: -8.0476, longitude: -34.877 }, capacity: 8,
  admissionMode: 'manual_approval', official: false,
};
const preview = {
  id: EVENT_ID, activityType: { code: 'caminhada', label: 'Caminhada' }, title: 'Caminhada no parque',
  description: 'Encontro informal para caminhar.', startsAt: '2026-11-15T12:00:00.000Z', endsAt: null,
  timeZone: 'America/Recife', location: { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife',
    approximateArea: { latitude: -8.045, longitude: -34.875, radiusMeters: 500 } }, capacity: 8,
  admissionMode: 'manual_approval', status: 'draft',
};

describe('events BFF (SDD-027–029, ADR-062/064)', () => {
  test('creates with one internal upstream call and returns only the strict owner projection', async () => {
    const backend = fakeBackend(201, ownerDraft);
    const logs: string[] = [];
    const response = await proxyCreateEventDraft(
      browserRequest('/api/events/drafts', { body: { activityTypeCode: 'caminhada', title: 'Caminhada no parque' }, cookie }),
      { env: testEnv(), fetchImpl: backend.fetchImpl, log: (line) => logs.push(line) },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: ownerDraft, statusCode: 201 });
    expect(backend.calls).toHaveLength(1);
    expect(backend.calls[0]?.url).toBe('http://backend.test/api/v1/events/drafts');
    expect(backend.calls[0]?.init.method).toBe('POST');
    expect(backend.calls[0]?.init.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(backend.calls[0]?.init.headers.get('x-eventmatch-bff-token')).toBe(testEnv().BFF_INTERNAL_TOKEN);
    expect(JSON.stringify(logs)).not.toContain('Caminhada');
    expect(JSON.parse(logs[0] ?? '{}')).toEqual(expect.objectContaining({ scope: 'events-bff', operation: 'event.draft.create', status: 201, correlationId: expect.any(String) }));
  });

  test('returns 404 with no upstream request while the event UI flag is disabled', async () => {
    const backend = fakeBackend(200, ownerDraft);
    const response = await proxyCreateEventDraft(
      browserRequest('/api/events/drafts', { body: {}, cookie }),
      { env: testEnv({ EVENTS_UI_ENABLED: false }), fetchImpl: backend.fetchImpl },
    );
    expect(response.status).toBe(404);
    expect(backend.calls).toHaveLength(0);
  });

  test('checks trusted origin and JSON before any upstream call', async () => {
    const backend = fakeBackend(201, ownerDraft);
    const foreignOrigin = browserRequest('/api/events/drafts', { body: {}, cookie, headers: { origin: 'https://outside.test' } });
    const noJson = browserRequest('/api/events/drafts', { body: {}, cookie, headers: { 'content-type': 'text/plain' } });
    const malformed = new Request('http://app.test/api/events/drafts', { method: 'POST', headers: { origin: 'http://app.test', 'content-type': 'application/json', cookie } , body: '{' });

    expect((await proxyCreateEventDraft(foreignOrigin, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(403);
    expect((await proxyCreateEventDraft(noJson, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(403);
    expect((await proxyCreateEventDraft(malformed, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(400);
    expect(backend.calls).toHaveLength(0);
  });

  test('rejects bodies above the bounded request size before contacting NestJS', async () => {
    const backend = fakeBackend(201, ownerDraft);
    const request = browserRequest('/api/events/drafts', { body: JSON.stringify({ title: 'x'.repeat(16_385) }), cookie });
    const response = await proxyCreateEventDraft(request, { env: testEnv(), fetchImpl: backend.fetchImpl });
    expect(response.status).toBe(400);
    expect(backend.calls).toHaveLength(0);
  });

  test('expires a missing or expired session without contacting NestJS', async () => {
    const backend = fakeBackend(200, ownerDraft);
    const response = await proxyEventDraft(
      new Request(`http://app.test/api/events/drafts/${EVENT_ID}`), EVENT_ID,
      { env: testEnv(), fetchImpl: backend.fetchImpl },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('eventmatch_session=; Path=/; Max-Age=0');
    expect(backend.calls).toHaveLength(0);
  });

  test('reads the owner draft with one authenticated request and without requiring an Origin header', async () => {
    const backend = fakeBackend(200, ownerDraft);
    const response = await proxyEventDraft(
      new Request(`http://app.test/api/events/drafts/${EVENT_ID}`, { headers: { cookie } }), EVENT_ID,
      { env: testEnv(), fetchImpl: backend.fetchImpl },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: ownerDraft });
    expect(backend.calls).toHaveLength(1);
    expect(backend.calls[0]?.url).toBe(`http://backend.test/api/v1/events/drafts/${EVENT_ID}`);
  });

  test('publishes only after strict JSON validation, preserving revision conflicts neutrally', async () => {
    const conflict = fakeBackend(409, { detail: 'private internal reason' });
    const invalid = browserRequest(`/api/events/drafts/${EVENT_ID}/publish`, { body: { revision: 1, unexpected: true }, cookie });
    const conflictResponse = await proxyPublishEvent(
      browserRequest(`/api/events/drafts/${EVENT_ID}/publish`, { body: { revision: 1 }, cookie }), EVENT_ID,
      { env: testEnv(), fetchImpl: conflict.fetchImpl },
    );
    const invalidResponse = await proxyPublishEvent(invalid, EVENT_ID, { env: testEnv(), fetchImpl: conflict.fetchImpl });
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.text()).not.toContain('private internal reason');
    expect(invalidResponse.status).toBe(400);
    expect(conflict.calls).toHaveLength(1);
  });

  test('keeps only the approximate area and rejects extra owner or preview response fields', async () => {
    const backend = fakeBackend(200, preview);
    const response = await proxyEventPreview(
      new Request(`http://app.test/api/events/drafts/${EVENT_ID}/preview`, { headers: { cookie } }), EVENT_ID,
      { env: testEnv(), fetchImpl: backend.fetchImpl },
    );
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('approximateArea');
    expect(body).toContain('-8.045');
    expect(body).not.toContain('-8.0476');

    const malformed = fakeBackend(200, { ...ownerDraft, internalAudit: 'private' });
    const ownerResponse = await proxyEventDraft(
      new Request(`http://app.test/api/events/drafts/${EVENT_ID}`, { headers: { cookie } }), EVENT_ID,
      { env: testEnv(), fetchImpl: malformed.fetchImpl },
    );
    expect(ownerResponse.status).toBe(503);
  });

  test('searches locations through one authenticated, allowlisted upstream request without logging the query', async () => {
    const results = { results: [{ kind: 'place', label: 'Praça do Arsenal, Recife, Pernambuco', latitude: -8.0631, longitude: -34.8711 }] };
    const backend = fakeBackend(200, results);
    const logs: string[] = [];
    const response = await proxySearchEventLocations(
      browserRequest(`/api/events/drafts/${EVENT_ID}/location-search`, { body: { query: 'Praça do Arsenal' }, cookie }),
      EVENT_ID,
      { env: testEnv(), fetchImpl: backend.fetchImpl, log: (line) => logs.push(line) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: results, statusCode: 200 });
    expect(backend.calls).toHaveLength(1);
    expect(backend.calls[0]?.url).toBe(`http://backend.test/api/v1/events/drafts/${EVENT_ID}/location-search`);
    expect(backend.calls[0]?.init.method).toBe('POST');
    expect(backend.calls[0]?.init.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(backend.calls[0]?.init.headers.get('x-eventmatch-bff-token')).toBe(testEnv().BFF_INTERNAL_TOKEN);
    expect(JSON.parse(String(backend.calls[0]?.init.body))).toEqual({ query: 'Praça do Arsenal' });
    expect(JSON.stringify(logs)).not.toContain('Praça do Arsenal');

    const limited = fakeBackend(429, {});
    const limitedResponse = await proxySearchEventLocations(
      browserRequest(`/api/events/drafts/${EVENT_ID}/location-search`, { body: { query: 'Praça do Arsenal' }, cookie }),
      EVENT_ID,
      { env: testEnv(), fetchImpl: limited.fetchImpl },
    );
    expect(limitedResponse.status).toBe(429);
    expect(await limitedResponse.text()).not.toContain('Praça do Arsenal');
  });

  test('rejects invalid or unauthenticated location searches before calling NestJS', async () => {
    const backend = fakeBackend(200, { results: [] });
    const validPath = `/api/events/drafts/${EVENT_ID}/location-search`;
    const foreignOrigin = browserRequest(validPath, { body: { query: 'Recife' }, cookie, headers: { origin: 'https://outside.test' } });
    const extraField = browserRequest(validPath, { body: { query: 'Recife', accountId: 'private' }, cookie });
    const noSession = browserRequest(validPath, { body: { query: 'Recife' } });

    expect((await proxySearchEventLocations(foreignOrigin, EVENT_ID, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(403);
    expect((await proxySearchEventLocations(extraField, EVENT_ID, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(400);
    expect((await proxySearchEventLocations(noSession, EVENT_ID, { env: testEnv(), fetchImpl: backend.fetchImpl })).status).toBe(401);
    expect(backend.calls).toHaveLength(0);
  });

  test('expires a session on upstream 401 and maps malformed success or unavailable responses to 503', async () => {
    for (const status of [401, 200, 503]) {
      const backend = status === 200
        ? fakeBackend(200, { ...ownerDraft, exactLocation: { latitude: 900, longitude: 0 } })
        : fakeBackend(status, { private: 'secret' });
      const response = await proxyEventDraft(
        new Request(`http://app.test/api/events/drafts/${EVENT_ID}`, { headers: { cookie } }), EVENT_ID,
        { env: testEnv(), fetchImpl: backend.fetchImpl },
      );
      expect(response.status).toBe(status === 401 ? 401 : 503);
      expect(await response.text()).not.toContain('secret');
      expect(backend.calls).toHaveLength(1);
      if (status === 401) expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    }
  });
});
