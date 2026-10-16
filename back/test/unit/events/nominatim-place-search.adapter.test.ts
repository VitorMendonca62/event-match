import { describe, expect, mock, test } from 'bun:test';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../src/shared/infrastructure/config/env';
import { NominatimPlaceSearchAdapter } from '../../../src/modules/events/infrastructure/integrations/nominatim-place-search.adapter';
import type { LocationSearchRateGatePort } from '../../../src/modules/events/domain/ports/location-search-rate-gate.port';
import type { PlaceSearchInput } from '../../../src/modules/events/domain/ports/place-search.port';

const input: PlaceSearchInput = {
  query: 'Marco Zero',
  municipalityName: 'Recife',
  ufCode: 'PE',
  federativeUnitName: 'Pernambuco',
};

function createSubject(tryAcquire = mock(async () => true)) {
  const config = {
    getOrThrow: (key: string) => ({
      EVENT_LOCATION_SEARCH_URL: 'https://nominatim.openstreetmap.org/search',
      EVENT_LOCATION_SEARCH_USER_AGENT: 'EventMatch/test',
    })[key],
  } as unknown as ConfigService<BackendEnv, true>;
  const rateGate = { tryAcquire } as LocationSearchRateGatePort;
  return { subject: new NominatimPlaceSearchAdapter(config, rateGate), tryAcquire };
}

function installFetch(handler: (url: URL, init?: RequestInit) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (request: RequestInfo | URL, init?: RequestInit) =>
    handler(new URL(request instanceof Request ? request.url : String(request)), init)) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

describe('NominatimPlaceSearchAdapter', () => {
  test('filters to the selected municipality and projects only the allowlisted result fields', async () => {
    const restoreFetch = installFetch(async (url, init) => {
      expect(url.searchParams.get('q')).toBe('Marco Zero, Recife, Pernambuco, Brasil');
      expect(url.searchParams.get('countrycodes')).toBe('br');
      expect(new Headers(init?.headers).get('user-agent')).toBe('EventMatch/test');
      return new Response(JSON.stringify([
        {
          place_id: 42,
          display_name: 'Marco Zero, Recife, Pernambuco, Brasil',
          type: 'attraction',
          name: 'Marco Zero',
          lat: '-8.0631',
          lon: '-34.8711',
          address: { city: 'Recife', state_code: 'pe', country_code: 'br', road: 'Av. Alfredo Lisboa', house_number: 's/n' },
        },
        {
          place_id: 43,
          name: 'Praça incompatível',
          lat: '-8.2',
          lon: '-34.9',
          address: { city: 'Olinda', state_code: 'pe', country_code: 'br' },
        },
      ]), { status: 200 });
    });
    try {
      const { subject } = createSubject();
      const outcome = await subject.search(input);
      expect(outcome).toEqual({ kind: 'results', results: [{
        kind: 'place',
        label: 'Marco Zero — Av. Alfredo Lisboa, nº s/n, Recife, Pernambuco',
        latitude: -8.0631,
        longitude: -34.8711,
      }] });
      expect(JSON.stringify(outcome)).not.toContain('place_id');
      expect(JSON.stringify(outcome)).not.toContain('display_name');
    } finally { restoreFetch(); }
  });

  test('returns no result for another state or invalid coordinates', async () => {
    const restoreFetch = installFetch(async () => new Response(JSON.stringify([
      { name: 'Outro estado', lat: '-8.0', lon: '-34.0', address: { city: 'Recife', state_code: 'sp', country_code: 'br' } },
      { name: 'Coordenada inválida', lat: '999', lon: '-34.0', address: { city: 'Recife', state_code: 'pe', country_code: 'br' } },
    ]), { status: 200 }));
    try {
      const { subject } = createSubject();
      await expect(subject.search(input)).resolves.toEqual({ kind: 'results', results: [] });
    } finally { restoreFetch(); }
  });

  test('reports HTTP and network failures as unavailable', async () => {
    const restoreFetch = installFetch(async () => new Response('temporarily unavailable', { status: 503 }));
    try {
      const { subject } = createSubject();
      await expect(subject.search(input)).resolves.toEqual({ kind: 'unavailable' });
    } finally { restoreFetch(); }

    const restoreNetworkFailure = installFetch(async () => { throw new Error('network details must not escape'); });
    try {
      const { subject } = createSubject();
      await expect(subject.search(input)).resolves.toEqual({ kind: 'unavailable' });
    } finally { restoreNetworkFailure(); }
  });

  test('does not call Nominatim when the shared rate gate is closed', async () => {
    const restoreFetch = installFetch(async () => { throw new Error('fetch must not be called'); });
    try {
      const tryAcquire = mock(async () => false);
      const { subject } = createSubject(tryAcquire);
      await expect(subject.search(input)).resolves.toEqual({ kind: 'rate_limited' });
      expect(tryAcquire).toHaveBeenCalledTimes(1);
    } finally { restoreFetch(); }
  });
});
