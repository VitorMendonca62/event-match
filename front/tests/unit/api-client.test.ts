import { describe, expect, test } from 'bun:test';

import { callRegistrationApi, cancelRegistration } from '../../src/features/registration/api-client';
import { eligibilityDataSchema } from '../../src/features/registration/contracts';

function reply(status: number, data: object = {}) {
  return (async () =>
    new Response(JSON.stringify({ data, message: 'x', statusCode: status }), { status })) as unknown as typeof fetch;
}

const call = { path: '/api/registration/eligibility', method: 'POST' as const, body: { birthDate: '1990-05-10' } };

describe('callRegistrationApi', () => {
  test('maps statuses to UI outcomes without exposing payloads', async () => {
    expect(await callRegistrationApi(call, eligibilityDataSchema, reply(200, { eligible: true }))).toEqual({
      kind: 'ok',
      data: { eligible: true },
    });
    expect((await callRegistrationApi(call, eligibilityDataSchema, reply(400))).kind).toBe('invalid');
    expect((await callRegistrationApi(call, eligibilityDataSchema, reply(401))).kind).toBe('expired');
    expect((await callRegistrationApi(call, eligibilityDataSchema, reply(404))).kind).toBe('unavailable');
    expect((await callRegistrationApi(call, eligibilityDataSchema, reply(409))).kind).toBe('conflict');
    expect((await callRegistrationApi(call, eligibilityDataSchema, reply(503))).kind).toBe('failed');
  });

  test('keeps only public 422 reasons', async () => {
    expect(await callRegistrationApi(call, eligibilityDataSchema, reply(422, { reason: 'weak_password' }))).toEqual({
      kind: 'unprocessable',
      reason: 'weak_password',
    });
    expect(await callRegistrationApi(call, eligibilityDataSchema, reply(422, { reason: 'contact_exists' }))).toEqual({
      kind: 'unprocessable',
    });
  });

  test('a network error or an unexpected success body is an unknown outcome', async () => {
    const offline = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect((await callRegistrationApi(call, eligibilityDataSchema, offline)).kind).toBe('failed');
    expect((await callRegistrationApi(call, eligibilityDataSchema, reply(200, { other: 1 }))).kind).toBe('failed');
  });

  test('sends JSON and the idempotency key, and nothing else sensitive', async () => {
    let captured: RequestInit | undefined;
    const spy = (async (_: string, init: RequestInit) => {
      captured = init;
      return new Response(JSON.stringify({ data: { eligible: true }, message: 'x', statusCode: 200 }));
    }) as unknown as typeof fetch;
    await callRegistrationApi({ ...call, idempotencyKey: 'key-0123456789abcdef' }, eligibilityDataSchema, spy);
    const headers = captured?.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['idempotency-key']).toBe('key-0123456789abcdef');
    expect(captured?.credentials).toBe('same-origin');
  });
});

describe('cancelRegistration (ADR-030)', () => {
  test('sends one same-origin DELETE with a JSON body and maps the outcome', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ data: { cancelled: true }, message: 'x', statusCode: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    expect(await cancelRegistration(fetchImpl)).toEqual({ kind: 'ok', data: { cancelled: true } });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('/api/registration');
    expect(seen[0]?.init.method).toBe('DELETE');
    expect((seen[0]?.init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(seen[0]?.init.body).toBe('{}');
    expect(seen[0]?.init.credentials).toBe('same-origin');
  });

  test('an expired session counts as expired and an unreachable backend as failed', async () => {
    expect((await cancelRegistration(reply(401))).kind).toBe('expired');
    expect((await cancelRegistration(reply(503))).kind).toBe('failed');
    expect((await cancelRegistration((async () => { throw new Error('offline'); }) as unknown as typeof fetch)).kind).toBe('failed');
  });
});
