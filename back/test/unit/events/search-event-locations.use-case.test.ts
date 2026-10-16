import { describe, expect, mock, test } from 'bun:test';

import { Event } from '../../../src/modules/events/domain/entities/event';
import type { EventRepositoryPort } from '../../../src/modules/events/domain/ports/event-repository.port';
import type { MunicipalityCatalogReaderPort, MunicipalitySummary } from '../../../src/modules/catalog/domain/ports/municipality-catalog-reader.port';
import type { PlaceSearchPort } from '../../../src/modules/events/domain/ports/place-search.port';
import type { UnitOfWorkPort } from '../../../src/shared/application/ports/unit-of-work.port';
import { SearchEventLocations } from '../../../src/modules/events/application/use-cases/search-event-locations.use-case';

const HOST_ID = '00000000-0000-7000-8000-000000000001';
const EVENT_ID = '00000000-0000-7000-8000-000000000002';
const municipality = {
  ufCode: 'PE' as const,
  municipalityCode: '2611606',
  municipalityName: 'Recife',
  active: true,
  federativeUnitName: 'Pernambuco',
};
const result = { kind: 'place' as const, label: 'Marco Zero — Recife, Pernambuco', latitude: -8.0631, longitude: -34.8711 };

function createSubject(options: Readonly<{
  record?: { event: Event; exactLocation: null } | null;
  municipality?: MunicipalitySummary | null;
  outcome?: Awaited<ReturnType<PlaceSearchPort['search']>>;
}> = {}) {
  const event = Event.create(EVENT_ID, HOST_ID).updateDraft({
    location: { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife', timeZone: 'America/Recife' },
  });
  const findByIdForOwnerWithoutExact = mock(async () => options.record === undefined ? { event, exactLocation: null } : options.record);
  const findByCodeAndUf = mock(async () => options.municipality === undefined ? municipality : options.municipality);
  const search = mock(async () => options.outcome ?? { kind: 'results' as const, results: [result] });
  const uow: UnitOfWorkPort = { async execute<T>(work: (context: object) => Promise<T>) { return work({}); } };
  const events = { findByIdForOwnerWithoutExact } as unknown as EventRepositoryPort;
  const municipalities = { findByCodeAndUf } as unknown as MunicipalityCatalogReaderPort;
  const places = { search } as unknown as PlaceSearchPort;

  return {
    subject: new SearchEventLocations(uow, events, municipalities, places),
    findByIdForOwnerWithoutExact,
    findByCodeAndUf,
    search,
  };
}

describe('SearchEventLocations', () => {
  test('checks draft ownership before calling the provider', async () => {
    const { subject, search } = createSubject({ record: null });

    await expect(subject.execute({ hostAccountId: HOST_ID, eventId: EVENT_ID, query: 'Marco Zero' }))
      .rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' });
    expect(search).not.toHaveBeenCalled();
  });

  test('rejects an inactive or incompatible municipality before search', async () => {
    const { subject, findByCodeAndUf, search } = createSubject({
      municipality: { ...municipality, ufCode: 'SP', municipalityCode: '3550308' },
    });

    await expect(subject.execute({ hostAccountId: HOST_ID, eventId: EVENT_ID, query: 'Museu' }))
      .rejects.toMatchObject({ code: 'INVALID_LOCATION' });
    expect(findByCodeAndUf).toHaveBeenCalledWith(expect.anything(), { ufCode: 'PE', municipalityCode: '2611606' });
    expect(search).not.toHaveBeenCalled();
  });

  test('uses the municipality saved on the owned draft and returns only provider result fields', async () => {
    const { subject, search, findByIdForOwnerWithoutExact } = createSubject();

    await expect(subject.execute({ hostAccountId: HOST_ID, eventId: EVENT_ID, query: '  Marco Zero  ' }))
      .resolves.toEqual({ results: [result] });
    expect(findByIdForOwnerWithoutExact).toHaveBeenCalledWith(expect.anything(), EVENT_ID, HOST_ID);
    expect(search).toHaveBeenCalledWith({
      query: 'Marco Zero',
      municipalityName: 'Recife',
      ufCode: 'PE',
      federativeUnitName: 'Pernambuco',
    });
  });

  test('turns provider unavailability into a domain error', async () => {
    const { subject, search } = createSubject({ outcome: { kind: 'unavailable' } });

    await expect(subject.execute({ hostAccountId: HOST_ID, eventId: EVENT_ID, query: 'Parque' }))
      .rejects.toMatchObject({ code: 'LOCATION_SEARCH_UNAVAILABLE' });
    expect(search).toHaveBeenCalledTimes(1);
  });
});
