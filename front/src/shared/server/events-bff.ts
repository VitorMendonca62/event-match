import 'server-only';

import { z } from 'zod';
import { envelopeSchema } from '@/features/registration/contracts';
import type { BffEnv } from '@/shared/config/bff-env.server';
import {
  createEventDraftRequestSchema,
  eventOwnerDraftSchema,
  eventPreviewSchema,
  eventLocationSearchRequestSchema,
  eventLocationSearchResponseSchema,
  publishEventRequestSchema,
  redactEventPreview,
  updateEventDraftRequestSchema,
} from '@/features/events/contracts';
import { callBackend } from './backend-client';
import { expiredSessionCookie, readSessionCookie } from './authentication-cookie';
import { logBffEvent } from './bff-logger';
import { jsonResponse } from './bff-proxy';
import { hasJsonContentType, hasTrustedOrigin } from './same-origin';

export type EventsBffDeps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch; log?: (line: string) => void }>;

type Envelope = Readonly<{ data: Record<string, unknown>; message: string; statusCode: number }>;
const EVENT_ID_SCHEMA = z.uuid();
const MAX_BODY_BYTES = 16 * 1024;
const MESSAGES: Readonly<Record<number, string>> = {
  200: 'Request completed successfully.',
  201: 'Draft created.',
  400: 'Invalid request.',
  401: 'Authentication is required.',
  403: 'Forbidden.',
  404: 'Resource not found.',
  409: 'The request conflicts with the current resource state.',
  429: 'Location search is temporarily rate limited.',
  422: 'The request could not be processed.',
  503: 'Service is temporarily unavailable.',
};

function dataOf(body: unknown): unknown {
  const parsed = envelopeSchema.safeParse(body);
  return parsed.success ? parsed.data.data : undefined;
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/u.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) return { ok: false };
  if (!request.body) return { ok: true, value: {} };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    try { return { ok: true, value: text.length ? JSON.parse(text) : {} }; }
    catch { return { ok: false }; }
  } catch {
    return { ok: false };
  } finally {
    reader.releaseLock();
  }
}

function safeStatus(upstreamStatus: number): number {
  return [400, 403, 404, 409, 422, 429].includes(upstreamStatus) ? upstreamStatus : 503;
}

function operationResponse(statusCode: number, data: Record<string, unknown> = {}): Envelope {
  return { data, message: MESSAGES[statusCode] ?? 'Request failed.', statusCode };
}

async function execute(
  request: Request,
  deps: EventsBffDeps,
  operation: string,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  responseSchema: z.ZodTypeAny,
  requestSchema?: z.ZodTypeAny,
  projectResponse?: (value: unknown) => unknown,
): Promise<Response> {
  const startedAt = performance.now();
  const correlationId = crypto.randomUUID();
  const finish = (statusCode: number, data: Record<string, unknown> = {}, cookies: readonly string[] = []) => {
    logBffEvent({ scope: 'events-bff', operation, status: statusCode, durationMs: performance.now() - startedAt, correlationId }, deps.log);
    return jsonResponse(operationResponse(statusCode, data), cookies);
  };

  if (!deps.env.EVENTS_UI_ENABLED) return finish(404);
  const mutation = method !== 'GET';
  if (request.method !== method) return finish(400);
  if (mutation && (!hasTrustedOrigin(request, deps.env) || !hasJsonContentType(request))) return finish(403);

  let body: unknown;
  if (requestSchema) {
    const raw = await readJsonBody(request);
    const parsed = raw.ok ? requestSchema.safeParse(raw.value) : undefined;
    if (!parsed?.success) return finish(400);
    body = parsed.data;
  }

  const session = readSessionCookie(request.headers.get('cookie'), deps.env);
  if (!session) return finish(401, {}, [expiredSessionCookie(deps.env)]);

  const upstream = await callBackend({ method, path, internal: true, session, ...(requestSchema ? { body } : {}) }, deps.env, deps.fetchImpl);
  if (upstream.status === 401) return finish(401, {}, [expiredSessionCookie(deps.env)]);

  const parsedData = dataOf(upstream.body);
  const projected = projectResponse ? projectResponse(parsedData) : parsedData;
  const data = upstream.status >= 200 && upstream.status < 300 ? responseSchema.safeParse(projected) : undefined;
  if (data?.success) return finish(upstream.status, data.data as Record<string, unknown>);

  return finish(safeStatus(upstream.status));
}

export function proxyCreateEventDraft(request: Request, deps: EventsBffDeps): Promise<Response> {
  return execute(request, deps, 'event.draft.create', 'POST', '/events/drafts', eventOwnerDraftSchema, createEventDraftRequestSchema);
}

export function proxyEventDraft(request: Request, eventId: string, deps: EventsBffDeps): Promise<Response> {
  if (!deps.env.EVENTS_UI_ENABLED) return Promise.resolve(jsonResponse(operationResponse(404)));
  const id = EVENT_ID_SCHEMA.safeParse(eventId);
  if (!id.success) return Promise.resolve(jsonResponse(operationResponse(400)));
  if (request.method === 'GET') return execute(request, deps, 'event.draft.read', 'GET', `/events/drafts/${id.data}`, eventOwnerDraftSchema);
  return execute(request, deps, 'event.draft.update', 'PUT', `/events/drafts/${id.data}`, eventOwnerDraftSchema, updateEventDraftRequestSchema);
}

export function proxyEventPreview(request: Request, eventId: string, deps: EventsBffDeps): Promise<Response> {
  if (!deps.env.EVENTS_UI_ENABLED) return Promise.resolve(jsonResponse(operationResponse(404)));
  const id = EVENT_ID_SCHEMA.safeParse(eventId);
  if (!id.success) return Promise.resolve(jsonResponse(operationResponse(400)));
  return execute(request, deps, 'event.draft.preview', 'GET', `/events/drafts/${id.data}/preview`, eventPreviewSchema, undefined, redactEventPreview);
}

export function proxySearchEventLocations(request: Request, eventId: string, deps: EventsBffDeps): Promise<Response> {
  if (!deps.env.EVENTS_UI_ENABLED) return Promise.resolve(jsonResponse(operationResponse(404)));
  const id = EVENT_ID_SCHEMA.safeParse(eventId);
  if (!id.success) return Promise.resolve(jsonResponse(operationResponse(400)));
  return execute(request, deps, 'event.location.search', 'POST', `/events/drafts/${id.data}/location-search`, eventLocationSearchResponseSchema, eventLocationSearchRequestSchema);
}

export function proxyPublishEvent(request: Request, eventId: string, deps: EventsBffDeps): Promise<Response> {
  if (!deps.env.EVENTS_UI_ENABLED) return Promise.resolve(jsonResponse(operationResponse(404)));
  const id = EVENT_ID_SCHEMA.safeParse(eventId);
  if (!id.success) return Promise.resolve(jsonResponse(operationResponse(400)));
  return execute(request, deps, 'event.publish', 'POST', `/events/drafts/${id.data}/publish`, eventOwnerDraftSchema, publishEventRequestSchema);
}
