import type { z } from 'zod';

import { envelopeSchema, errorReasonDataSchema, type PublicErrorReason } from './contracts';

/** Browser outcome of one BFF call, already reduced to what the UI may act on (plan §4.5). */
export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'conflict' }
  | { kind: 'unprocessable'; reason?: PublicErrorReason }
  | { kind: 'unavailable' }
  /** The result is unknown (5xx, timeout, network): a manual retry may reuse the same key. */
  | { kind: 'failed' };

export type ApiCall = Readonly<{
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
}>;

export async function callRegistrationApi<T>(
  call: ApiCall,
  schema: z.ZodType<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (call.body !== undefined) headers['content-type'] = 'application/json';
  if (call.idempotencyKey) headers['idempotency-key'] = call.idempotencyKey;

  let response: Response;
  try {
    response = await fetchImpl(call.path, {
      method: call.method,
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { kind: 'failed' };
  }

  const envelope = envelopeSchema.safeParse(await response.json().catch(() => undefined));
  if (response.ok) {
    const data = envelope.success ? schema.safeParse(envelope.data.data) : undefined;
    return data?.success ? { kind: 'ok', data: data.data } : { kind: 'failed' };
  }
  switch (response.status) {
    case 400:
    case 403:
      return { kind: 'invalid' };
    case 401:
      return { kind: 'expired' };
    case 404:
      return { kind: 'unavailable' };
    case 409:
      return { kind: 'conflict' };
    case 422: {
      const reason = envelope.success ? errorReasonDataSchema.safeParse(envelope.data.data) : undefined;
      return { kind: 'unprocessable', ...(reason?.success && reason.data.reason ? { reason: reason.data.reason } : {}) };
    }
    default:
      return { kind: 'failed' };
  }
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
