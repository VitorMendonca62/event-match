import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import { LOCATION_SEARCH_RATE_GATE_PORT, type LocationSearchRateGatePort } from '../../domain/ports/location-search-rate-gate.port';
import type { PlaceSearchInput, PlaceSearchOutcome, PlaceSearchPort, PlaceSearchResult } from '../../domain/ports/place-search.port';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 1_000;
const REQUEST_TIMEOUT_MS = 6_000;

type CacheEntry = Readonly<{ expiresAt: number; results: readonly PlaceSearchResult[] }>;
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

function addressMatches(input: PlaceSearchInput, address: UnknownRecord): boolean {
  const expectedCity = normalized(input.municipalityName);
  const cityValues = ['city', 'town', 'village', 'municipality', 'county']
    .map((key) => text(address[key]))
    .filter((value): value is string => Boolean(value));
  if (!cityValues.some((value) => normalized(value) === expectedCity)) return false;

  const countryCode = text(address.country_code);
  if (countryCode?.toLowerCase() !== 'br') return false;
  const stateCode = text(address.state_code)?.toLowerCase();
  if (stateCode) return stateCode === input.ufCode.toLowerCase() || stateCode.endsWith(`-${input.ufCode.toLowerCase()}`);
  const stateName = text(address.state);
  return Boolean(stateName && normalized(stateName) === normalized(input.federativeUnitName));
}

function placeName(item: UnknownRecord): string | undefined {
  const names = isRecord(item.namedetails) ? item.namedetails : {};
  return text(names['name:pt-BR']) ?? text(names['name:pt']) ?? text(names.name) ?? text(item.name);
}

function firstAddressValue(address: UnknownRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = text(address[key]);
    if (value) return value;
  }
  return undefined;
}

function placeLabel(item: UnknownRecord, address: UnknownRecord, input: PlaceSearchInput): string | undefined {
  const name = placeName(item);
  if (!name) return undefined;

  const street = firstAddressValue(address, ['road', 'pedestrian', 'residential', 'living_street', 'footway', 'path']);
  const number = text(address.house_number);
  const streetAndNumber = street
    ? `${street}${number ? `, nº ${number}` : ''}`
    : number ? `nº ${number}` : undefined;
  const neighborhood = firstAddressValue(address, ['neighbourhood', 'suburb', 'quarter', 'city_district']);
  const addressParts = [streetAndNumber, neighborhood, input.municipalityName, input.federativeUnitName]
    .filter((part): part is string => Boolean(part));
  return `${name} — ${addressParts.join(', ')}`.slice(0, 240);
}

function parseCoordinates(item: UnknownRecord): Readonly<{ latitude: number; longitude: number }> | undefined {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return undefined;
  return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
}

function resultsFrom(payload: unknown, input: PlaceSearchInput): readonly PlaceSearchResult[] {
  if (!Array.isArray(payload)) return [];
  const results: PlaceSearchResult[] = [];
  const seen = new Set<string>();
  for (const value of payload) {
    if (!isRecord(value) || !isRecord(value.address) || !addressMatches(input, value.address)) continue;
    const coordinates = parseCoordinates(value);
    if (!coordinates) continue;
    const label = input.query ? placeLabel(value, value.address, input) : `${input.municipalityName} · ${input.ufCode}`;
    if (!label) continue;
    const safeLabel = label.slice(0, 240);
    const key = `${normalized(safeLabel)}:${coordinates.latitude}:${coordinates.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ kind: input.query ? 'place' : 'municipality', label: safeLabel, ...coordinates });
    if (results.length === (input.query ? 5 : 1)) break;
  }
  return results;
}

@Injectable()
export class NominatimPlaceSearchAdapter implements PlaceSearchPort {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly config: ConfigService<BackendEnv, true>,
    @Inject(LOCATION_SEARCH_RATE_GATE_PORT) private readonly rateGate: LocationSearchRateGatePort,
  ) {}

  async search(input: PlaceSearchInput): Promise<PlaceSearchOutcome> {
    const cacheKey = createHash('sha256')
      .update(JSON.stringify([input.query, input.municipalityName, input.ufCode, input.federativeUnitName]))
      .digest('hex');
    const cached = this.getCached(cacheKey);
    if (cached) return { kind: 'results', results: cached };

    try {
      if (!(await this.rateGate.tryAcquire())) return { kind: 'rate_limited' };
      const url = new URL(this.config.getOrThrow<string>('EVENT_LOCATION_SEARCH_URL'));
      if (input.query) {
        url.searchParams.set('q', `${input.query}, ${input.municipalityName}, ${input.federativeUnitName}, Brasil`);
      } else {
        url.searchParams.set('city', input.municipalityName);
        url.searchParams.set('state', input.federativeUnitName);
        url.searchParams.set('country', 'Brasil');
      }
      url.searchParams.set('countrycodes', 'br');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('namedetails', '1');
      url.searchParams.set('limit', input.query ? '5' : '1');
      url.searchParams.set('accept-language', 'pt-BR');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': this.config.getOrThrow<string>('EVENT_LOCATION_SEARCH_USER_AGENT'),
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return { kind: 'unavailable' };
      const results = resultsFrom(await response.json(), input);
      this.setCached(cacheKey, results);
      return { kind: 'results', results };
    } catch {
      return { kind: 'unavailable' };
    }
  }

  private getCached(key: string): readonly PlaceSearchResult[] | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, cached);
    return cached.results;
  }

  private setCached(key: string, results: readonly PlaceSearchResult[]): void {
    this.cache.delete(key);
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results });
    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
  }
}
