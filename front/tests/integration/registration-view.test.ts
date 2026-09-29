import { describe, expect, test } from 'bun:test';

import { loadRegistrationView } from '../../src/shared/server/registration-view';
import { TOKEN, testEnv } from './bff-fixtures';

const env = testEnv();
const UUID = '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50';

function routedBackend(stage: string | null, order: string[] = []) {
  return (async (url: string) => {
    const path = new URL(url).pathname;
    order.push(`start ${path}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (path.endsWith('/registration')) {
      if (stage === null) return new Response(JSON.stringify({ data: {}, message: 'x', statusCode: 401 }), { status: 401 });
      return Response.json({ data: { stage, expiresAt: '2099-01-01T00:00:00.000Z' }, message: 'x', statusCode: 200 });
    }
    if (path.endsWith('/legal-documents')) {
      return Response.json({
        data: {
          documents: [{ id: UUID, kind: 'terms', version: '2026-10-01', locale: 'pt-BR', effectiveAt: '2026-10-01T00:00:00.000Z' }],
        },
        message: 'x',
        statusCode: 200,
      });
    }
    return Response.json({ data: { interests: [{ id: UUID, slug: 'cafe', label: 'Café' }] }, message: 'x', statusCode: 200 });
  }) as unknown as typeof fetch;
}

describe('loadRegistrationView', () => {
  test('without a continuation nothing is fetched', async () => {
    const calls: string[] = [];
    const view = await loadRegistrationView(undefined, { env, fetchImpl: routedBackend('age_eligible', calls) });
    expect(view.stage).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test('snapshot and catalogs start in parallel and only public fields are serialized', async () => {
    const order: string[] = [];
    const view = await loadRegistrationView(TOKEN, { env, fetchImpl: routedBackend('account_incomplete', order) });
    expect(order.slice(0, 3).every((entry) => entry.startsWith('start'))).toBe(true);
    expect(order).toHaveLength(3);
    expect(view.interests).toEqual({ status: 'ready', items: [{ id: UUID, label: 'Café' }] });
    expect(view.documents).toEqual({
      status: 'ready',
      items: [{ id: UUID, kind: 'terms', version: '2026-10-01', effectiveAt: '2026-10-01T00:00:00.000Z' }],
    });
    expect(JSON.stringify(view)).not.toContain(TOKEN);
  });

  test('catalogs are deferred before account_incomplete and a 401 marks the session expired', async () => {
    const early = await loadRegistrationView(TOKEN, { env, fetchImpl: routedBackend('verification_pending') });
    expect(early.documents).toEqual({ status: 'deferred' });
    const expired = await loadRegistrationView(TOKEN, { env, fetchImpl: routedBackend(null) });
    expect(expired).toMatchObject({ stage: null, sessionExpired: true });
  });
});
