import 'server-only';

import { envelopeSchema, interestListDataSchema, interestSchema } from '@/features/registration/contracts';
import { activityPreferenceListDataSchema, languageListDataSchema } from '@/features/profile/contracts';
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
