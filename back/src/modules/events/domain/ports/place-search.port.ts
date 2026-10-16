export const PLACE_SEARCH_PORT = Symbol('PLACE_SEARCH_PORT');

export type PlaceSearchInput = Readonly<{
  query: string;
  municipalityName: string;
  ufCode: string;
  federativeUnitName: string;
}>;

export type PlaceSearchResult = Readonly<{
  kind: 'municipality' | 'place';
  label: string;
  latitude: number;
  longitude: number;
}>;

export type PlaceSearchOutcome =
  | Readonly<{ kind: 'results'; results: readonly PlaceSearchResult[] }>
  | Readonly<{ kind: 'rate_limited' }>
  | Readonly<{ kind: 'unavailable' }>;

export interface PlaceSearchPort {
  search(input: PlaceSearchInput): Promise<PlaceSearchOutcome>;
}
