import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { MunicipalityCatalogReaderPort } from '../../../catalog/domain/ports/municipality-catalog-reader.port';
import { isUfCode } from '../../../catalog/domain/value-objects/location';
import type { EventRepositoryPort } from '../../domain/ports/event-repository.port';
import type { PlaceSearchPort, PlaceSearchResult } from '../../domain/ports/place-search.port';
import { EventError } from '../../domain/errors/event.error';

export class SearchEventLocations {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly events: EventRepositoryPort,
    private readonly municipalities: MunicipalityCatalogReaderPort,
    private readonly places: PlaceSearchPort,
  ) {}

  async execute(input: Readonly<{ hostAccountId: string; eventId: string; query?: string }>): Promise<Readonly<{ results: readonly PlaceSearchResult[] }>> {
    const query = input.query?.normalize('NFC').trim() ?? '';
    if (query.length > 80 || (query.length > 0 && !/^[\p{L}\p{N} .,'’()-]+$/u.test(query))) {
      throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
    }

    const context = await this.uow.execute(async (transaction) => {
      const record = await this.events.findByIdForOwnerWithoutExact(transaction, input.eventId, input.hostAccountId);
      if (!record) throw new EventError('EVENT_NOT_FOUND');
      const state = record.event.snapshot();
      if (state.status !== 'draft' || !state.location) throw new EventError('EVENT_NOT_READY', 'event_not_ready');
      const ufCode = state.location.ufCode;
      if (!isUfCode(ufCode)) throw new EventError('INVALID_LOCATION', 'invalid_location');

      const municipality = await this.municipalities.findByCodeAndUf(transaction, {
        ufCode,
        municipalityCode: state.location.municipalityCode,
      });
      if (
        !municipality?.active ||
        !municipality.federativeUnitName ||
        municipality.ufCode !== ufCode ||
        municipality.municipalityCode !== state.location.municipalityCode
      ) throw new EventError('INVALID_LOCATION', 'invalid_location');

      return {
        municipalityName: municipality.municipalityName,
        ufCode: municipality.ufCode,
        federativeUnitName: municipality.federativeUnitName,
      };
    });

    const outcome = await this.places.search({ ...context, query });
    if (outcome.kind === 'rate_limited') throw new EventError('LOCATION_SEARCH_RATE_LIMITED');
    if (outcome.kind === 'unavailable') throw new EventError('LOCATION_SEARCH_UNAVAILABLE');
    return { results: outcome.results };
  }
}
