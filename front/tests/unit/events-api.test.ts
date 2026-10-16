import { describe, expect, test } from 'bun:test';

import { createEventDraft, previewEventDraft, readEventDraft, saveEventDraft } from '../../src/features/events/api';
import type { EventOwnerDraft } from '../../src/features/events/contracts';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const draft = {
  id: ID, revision: 1, status: 'draft', activityType: null, title: null, description: null,
  startsAtLocal: null, endsAtLocal: null, startsAt: null, endsAt: null, timeZone: null, location: null,
  venueType: null, nonResidentialHostDeclaration: null, exactLocation: null, capacity: null,
  admissionMode: 'manual_approval', official: false,
} as const satisfies EventOwnerDraft;

function fakeFetch(handler: (path: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

function response(status: number, data: object) {
  return new Response(JSON.stringify({ data, message: 'neutral', statusCode: status }), { status });
}

describe('event API client', () => {
  test('creates a draft with one same-origin JSON request and validates the owner projection', async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const fetchImpl = fakeFetch(async (path, init) => { calls.push({ path, init: init ?? {} }); return response(201, draft); });
    const result = await createEventDraft({}, fetchImpl);
    expect(result).toEqual({ kind: 'ok', data: draft });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/api/events/drafts');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.cache).toBe('no-store');
    expect(calls[0]?.init.headers).toEqual({ 'content-type': 'application/json' });
    expect(calls[0]?.init.body).toBe('{}');
  });

  test('reads and saves only validated event ids; updates never retry', async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const fetchImpl = fakeFetch(async (path, init) => { calls.push({ path, init: init ?? {} }); return response(200, draft); });
    await readEventDraft(ID, fetchImpl);
    await saveEventDraft(ID, { revision: 1, title: null }, fetchImpl);
    await previewEventDraft('not-an-id', fetchImpl);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.init.method).toBe('PUT');
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ revision: 1, title: null });
  });

  test('maps conflict, expired session and unavailable responses without exposing upstream messages', async () => {
    const kinds = [409, 401, 503] as const;
    const results = await Promise.all(kinds.map((status) => readEventDraft(ID, fakeFetch(() => response(status, { privateDetail: 'never' })))));
    expect(results.map((result) => result.kind)).toEqual(['conflict', 'expired', 'unavailable']);
    expect(await readEventDraft(ID, fakeFetch(() => response(200, { ...draft, privateField: true })))).toEqual({ kind: 'unavailable' });
  });
});
