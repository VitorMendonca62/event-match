import { z } from 'zod';
import { envelopeSchema } from '@/features/registration/contracts';
import {
  createEventDraftRequestSchema,
  eventOwnerDraftSchema,
  eventLocationSearchRequestSchema,
  eventLocationSearchResponseSchema,
  eventPreviewSchema,
  updateEventDraftRequestSchema,
  type EventOwnerDraft,
  type EventPreview,
} from './contracts';

export type EventApiFailure = 'invalid' | 'expired' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited' | 'unavailable';
export type EventApiResult<T> = Readonly<{ kind: 'ok'; data: T }> | Readonly<{ kind: EventApiFailure }>;

type RequestOptions<T> = Readonly<{
  method: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } };
  fetchImpl?: typeof fetch;
}>;

async function request<T>(path: string, options: RequestOptions<T>): Promise<EventApiResult<T>> {
  try {
    const response = await (options.fetchImpl ?? fetch)(path, {
      method: options.method,
      cache: 'no-store',
      ...(options.body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(options.body) }),
    });
    const envelope = envelopeSchema.safeParse(await response.json());
    if (!envelope.success || envelope.data.statusCode !== response.status) return { kind: 'unavailable' };
    if (!response.ok) {
      if (response.status === 400 || response.status === 422) return { kind: 'invalid' };
      if (response.status === 401) return { kind: 'expired' };
      if (response.status === 403) return { kind: 'forbidden' };
      if (response.status === 404) return { kind: 'not_found' };
      if (response.status === 409) return { kind: 'conflict' };
      if (response.status === 429) return { kind: 'rate_limited' };
      return { kind: 'unavailable' };
    }
    const data = options.schema.safeParse(envelope.data.data);
    return data.success ? { kind: 'ok', data: data.data } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

function safeEventId(eventId: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(eventId)
    ? encodeURIComponent(eventId)
    : undefined;
}

export type CreateEventDraftInput = Readonly<z.input<typeof createEventDraftRequestSchema>>;
export type UpdateEventDraftInput = Readonly<z.input<typeof updateEventDraftRequestSchema>>;

export function createEventDraft(input: CreateEventDraftInput = {}, fetchImpl?: typeof fetch): Promise<EventApiResult<EventOwnerDraft>> {
  return request('/api/events/drafts', { method: 'POST', body: input, schema: eventOwnerDraftSchema, fetchImpl });
}

export function readEventDraft(eventId: string, fetchImpl?: typeof fetch): Promise<EventApiResult<EventOwnerDraft>> {
  const id = safeEventId(eventId);
  return id ? request(`/api/events/drafts/${id}`, { method: 'GET', schema: eventOwnerDraftSchema, fetchImpl }) : Promise.resolve({ kind: 'not_found' });
}

export function saveEventDraft(eventId: string, input: UpdateEventDraftInput, fetchImpl?: typeof fetch): Promise<EventApiResult<EventOwnerDraft>> {
  const id = safeEventId(eventId);
  return id ? request(`/api/events/drafts/${id}`, { method: 'PUT', body: input, schema: eventOwnerDraftSchema, fetchImpl }) : Promise.resolve({ kind: 'not_found' });
}

export function previewEventDraft(eventId: string, fetchImpl?: typeof fetch): Promise<EventApiResult<EventPreview>> {
  const id = safeEventId(eventId);
  return id ? request(`/api/events/drafts/${id}/preview`, { method: 'GET', schema: eventPreviewSchema, fetchImpl }) : Promise.resolve({ kind: 'not_found' });
}

export function searchEventLocations(eventId: string, query?: string, fetchImpl?: typeof fetch) {
  const id = safeEventId(eventId);
  if (!id) return Promise.resolve({ kind: 'not_found' } as const);
  const input = eventLocationSearchRequestSchema.safeParse(query === undefined ? {} : { query });
  if (!input.success) return Promise.resolve({ kind: 'invalid' } as const);
  return request(`/api/events/drafts/${id}/location-search`, {
    method: 'POST',
    body: input.data,
    schema: eventLocationSearchResponseSchema,
    fetchImpl,
  });
}

export function publishEventDraft(eventId: string, revision: number, fetchImpl?: typeof fetch): Promise<EventApiResult<EventOwnerDraft>> {
  const id = safeEventId(eventId);
  return id ? request(`/api/events/drafts/${id}/publish`, { method: 'POST', body: { revision }, schema: eventOwnerDraftSchema, fetchImpl }) : Promise.resolve({ kind: 'not_found' });
}
