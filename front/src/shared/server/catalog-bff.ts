import 'server-only';

import { envelopeSchema, interestListDataSchema, interestSchema } from '@/features/registration/contracts';
import { activityPreferenceListDataSchema, languageListDataSchema } from '@/features/profile/contracts';
import { federativeUnitListDataSchema, municipalityListDataSchema, ufCodeSchema } from '@/features/location/contracts';
import type { BffEnv } from '@/shared/config/bff-env.server';
import { callBackend } from './backend-client';
import { jsonResponse } from './bff-proxy';
import { z } from 'zod';

export type CatalogBffDeps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>;

type CatalogDefinition = Readonly<{
  path: string;
  responseSchema: z.ZodTypeAny;
  successMessage: string;
  invalidSuccessStatus: number;
  preserveUpstreamSuccessMessage?: boolean;
  preserveStatuses?: Readonly<Record<number, string>>;
}>;

const strictInterestListDataSchema = interestListDataSchema
  .extend({ interests: z.array(interestSchema.strict()) })
  .strict();

const strictFederativeUnitListDataSchema = federativeUnitListDataSchema.strict();
const strictMunicipalityListDataSchema = municipalityListDataSchema.strict();

const GENERIC_MESSAGES: Readonly<Record<number, string>> = {
  400: 'Invalid request.',
  401: 'Authentication is required.',
  404: 'Resource not found.',
  409: 'The request conflicts with the current resource state.',
  502: 'Upstream response was not understood.',
  503: 'Service is temporarily unavailable.',
};

const CATALOG_UNAVAILABLE = 'Catálogo indisponível.';

const INTERESTS: CatalogDefinition = {
  path: '/catalog/interests?locale=pt-BR',
  responseSchema: strictInterestListDataSchema,
  successMessage: 'Interesses disponíveis.',
  invalidSuccessStatus: 502,
  preserveUpstreamSuccessMessage: true,
  preserveStatuses: { 400: GENERIC_MESSAGES[400], 401: GENERIC_MESSAGES[401], 404: GENERIC_MESSAGES[404], 409: GENERIC_MESSAGES[409] },
};

const LANGUAGES: CatalogDefinition = {
  path: '/catalog/languages?locale=pt-BR',
  responseSchema: languageListDataSchema,
  successMessage: 'Idiomas disponíveis.',
  invalidSuccessStatus: 503,
};

const ACTIVITY_PREFERENCES: CatalogDefinition = {
  path: '/catalog/activity-preferences?locale=pt-BR',
  responseSchema: activityPreferenceListDataSchema,
  successMessage: 'Preferências de atividades disponíveis.',
  invalidSuccessStatus: 503,
};

const FEDERATIVE_UNITS: CatalogDefinition = {
  path: '/catalog/federative-units',
  responseSchema: strictFederativeUnitListDataSchema,
  successMessage: 'Estados disponíveis.',
  invalidSuccessStatus: 503,
};

function failedCatalogResponse(upstreamStatus: number, definition: CatalogDefinition): Response {
  const preservedMessage = definition.preserveStatuses?.[upstreamStatus];
  const statusCode = preservedMessage
    ? upstreamStatus
    : upstreamStatus === 200
      ? definition.invalidSuccessStatus
      : upstreamStatus === 400
        ? 400
        : 503;
  const message = preservedMessage ?? (definition.preserveUpstreamSuccessMessage ? GENERIC_MESSAGES[statusCode] : CATALOG_UNAVAILABLE);
  return jsonResponse({ data: {}, message, statusCode });
}

async function proxyCatalog(deps: CatalogBffDeps, definition: CatalogDefinition): Promise<Response> {
  const upstream = await callBackend({ method: 'GET', path: definition.path, internal: false }, deps.env, deps.fetchImpl);
  const envelope = envelopeSchema.safeParse(upstream.body);
  const data = envelope.success ? definition.responseSchema.safeParse(envelope.data.data) : undefined;

  if (upstream.status === 200 && envelope.success && data?.success) {
    return jsonResponse({
      data: data.data as Record<string, unknown>,
      message: definition.preserveUpstreamSuccessMessage ? envelope.data.message : definition.successMessage,
      statusCode: 200,
    });
  }

  return failedCatalogResponse(upstream.status, definition);
}

export function proxyInterestCatalog(deps: CatalogBffDeps): Promise<Response> {
  return proxyCatalog(deps, INTERESTS);
}

export function proxyLanguageCatalog(deps: CatalogBffDeps): Promise<Response> {
  return proxyCatalog(deps, LANGUAGES);
}

export function proxyActivityPreferenceCatalog(deps: CatalogBffDeps): Promise<Response> {
  return proxyCatalog(deps, ACTIVITY_PREFERENCES);
}

export function proxyFederativeUnitCatalog(deps: CatalogBffDeps): Promise<Response> {
  return proxyCatalog(deps, FEDERATIVE_UNITS);
}

const municipalityQuerySchema = z.strictObject({
  uf: ufCodeSchema,
  q: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{N} .'-]+$/u).transform((value) => value.normalize('NFC')).optional(),
});

export async function proxyMunicipalityCatalog(request: Request, deps: CatalogBffDeps): Promise<Response> {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== 'uf' && key !== 'q')) return jsonResponse({ data: {}, message: GENERIC_MESSAGES[400], statusCode: 400 });
  const parsed = municipalityQuerySchema.safeParse({ uf: url.searchParams.get('uf'), q: url.searchParams.get('q') });
  if (!parsed.success) return jsonResponse({ data: {}, message: GENERIC_MESSAGES[400], statusCode: 400 });
  const path = `/catalog/municipalities?uf=${encodeURIComponent(parsed.data.uf)}${parsed.data.q ? `&q=${encodeURIComponent(parsed.data.q)}` : ''}`;
  const upstream = await callBackend({ method: 'GET', path, internal: false }, deps.env, deps.fetchImpl);
  const envelope = envelopeSchema.safeParse(upstream.body);
  const data = envelope.success ? strictMunicipalityListDataSchema.safeParse(envelope.data.data) : undefined;
  if (upstream.status === 200 && envelope.success && data?.success) {
    return jsonResponse({ data: data.data, message: 'Municípios disponíveis.', statusCode: 200 });
  }
  return jsonResponse({ data: {}, message: upstream.status === 400 ? GENERIC_MESSAGES[400] : 'Catálogo indisponível.', statusCode: upstream.status === 400 ? 400 : 503 });
}
