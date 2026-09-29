import { describe, expect, test } from 'bun:test';

import { callRegistrationApi } from '../../src/features/registration/api-client';
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
