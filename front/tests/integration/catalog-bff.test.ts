import { describe, expect, test } from 'bun:test';
import { proxyActivityPreferenceCatalog, proxyInterestCatalog, proxyLanguageCatalog } from '../../src/shared/server/catalog-bff';
import type { CatalogBffDeps } from '../../src/shared/server/catalog-bff';
import { fakeBackend, testEnv } from './bff-fixtures';

const UUID = '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f51';

const catalogs = [
  {
    name: 'interests',
    path: 'http://backend.test/api/v1/catalog/interests?locale=pt-BR',
    data: { interests: [{ id: UUID, slug: 'cinema', label: 'Cinema' }] },
    proxy: proxyInterestCatalog,
    successMessage: 'upstream',
    invalidSuccessStatus: 502,
    invalidSuccessMessage: 'Upstream response was not understood.',
    badRequestMessage: 'Invalid request.',
  },
  {
    name: 'languages',
    path: 'http://backend.test/api/v1/catalog/languages?locale=pt-BR',
    data: { languages: [{ code: 'pt', label: 'Português' }] },
    proxy: proxyLanguageCatalog,
    successMessage: 'Idiomas disponíveis.',
    invalidSuccessStatus: 503,
    invalidSuccessMessage: 'Catálogo indisponível.',
    badRequestMessage: 'Catálogo indisponível.',
  },
  {
    name: 'activity preferences',
    path: 'http://backend.test/api/v1/catalog/activity-preferences?locale=pt-BR',
    data: { activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre' }] },
    proxy: proxyActivityPreferenceCatalog,
    successMessage: 'Preferências de atividades disponíveis.',
    invalidSuccessStatus: 503,
    invalidSuccessMessage: 'Catálogo indisponível.',
    badRequestMessage: 'Catálogo indisponível.',
  },
] as const;

type CatalogCase = (typeof catalogs)[number];

function depsFor(catalog: CatalogCase, fetchImpl: typeof fetch): CatalogBffDeps {
  void catalog;
  return { env: testEnv(), fetchImpl };
}

function malformedBackend(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit & { headers: Headers } }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit & { headers: Headers }) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('catalog BFF (ADR-050)', () => {
  for (const catalog of catalogs) {
    test(`${catalog.name} forwards one public request and preserves the response headers`, async () => {
      const backend = fakeBackend(200, catalog.data);
      const response = await catalog.proxy(depsFor(catalog, backend.fetchImpl));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: catalog.data, message: catalog.successMessage, statusCode: 200 });
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(backend.calls).toHaveLength(1);
      expect(backend.calls[0]?.url).toBe(catalog.path);
      expect(backend.calls[0]?.init.method).toBe('GET');
      expect(backend.calls[0]?.init.cache).toBe('no-store');
      expect(backend.calls[0]?.init.redirect).toBe('manual');
      expect(backend.calls[0]?.init.headers.get('authorization')).toBeNull();
      expect(backend.calls[0]?.init.headers.get('x-eventmatch-bff-token')).toBeNull();
    });

    test(`${catalog.name} rejects extra fields in items and data`, async () => {
      const itemKey = Object.keys(catalog.data)[0]!;
      const data = catalog.data as Record<string, readonly Record<string, unknown>[]>;
      const items = data[itemKey].map((item) => ({ ...item, active: false }));
      const extraItem = malformedBackend({ data: { ...catalog.data, [itemKey]: items }, message: 'upstream', statusCode: 200 });
      const extraData = malformedBackend({ data: { ...catalog.data, extra: true }, message: 'upstream', statusCode: 200 });

      const itemResponse = await catalog.proxy(depsFor(catalog, extraItem.fetchImpl));
      const dataResponse = await catalog.proxy(depsFor(catalog, extraData.fetchImpl));

      expect(itemResponse.status).toBe(catalog.invalidSuccessStatus);
      expect(await itemResponse.json()).toEqual({ data: {}, message: catalog.invalidSuccessMessage, statusCode: catalog.invalidSuccessStatus });
      expect(dataResponse.status).toBe(catalog.invalidSuccessStatus);
      expect(await dataResponse.json()).toEqual({ data: {}, message: catalog.invalidSuccessMessage, statusCode: catalog.invalidSuccessStatus });
      expect(extraItem.calls).toHaveLength(1);
      expect(extraData.calls).toHaveLength(1);
    });

    test(`${catalog.name} rejects malformed envelopes, upstream 500 and network failures closed`, async () => {
      const malformed = malformedBackend({ data: catalog.data, message: 'upstream' });
      const serverError = fakeBackend(500, { secret: 'never' });
      const offline = malformedBackend(undefined);
      offline.fetchImpl = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

      const malformedResponse = await catalog.proxy(depsFor(catalog, malformed.fetchImpl));
      const serverErrorResponse = await catalog.proxy(depsFor(catalog, serverError.fetchImpl));
      const offlineResponse = await catalog.proxy(depsFor(catalog, offline.fetchImpl));

      expect(malformedResponse.status).toBe(catalog.invalidSuccessStatus);
      expect(serverErrorResponse.status).toBe(503);
      expect(offlineResponse.status).toBe(503);
      expect(await serverErrorResponse.text()).not.toContain('secret');
      expect(serverError.calls).toHaveLength(1);
    });

    test(`${catalog.name} preserves the upstream 400 mapping`, async () => {
      const backend = fakeBackend(400, { detail: 'internal detail' });
      const response = await catalog.proxy(depsFor(catalog, backend.fetchImpl));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ data: {}, message: catalog.badRequestMessage, statusCode: 400 });
      expect(backend.calls).toHaveLength(1);
    });
  }
});
