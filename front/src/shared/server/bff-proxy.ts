/** @format */

import type { z } from 'zod';

import {
  envelopeSchema,
  errorReasonDataSchema,
} from '../../features/registration/contracts';
import type { BffEnv } from '../config/bff-env.server';
import { logBffEvent } from './bff-logger';
import { type BackendResponse, buildBackendCurl, callBackend } from './backend-client';
import {
  expiredContinuationCookie,
  readContinuationCookie,
  serializeContinuationCookie,
} from './continuation-cookie';
import { readIdempotencyKey } from './idempotency';
import { resolveOriginFingerprint } from './origin-fingerprint';
import { hasJsonContentType, hasTrustedOrigin } from './same-origin';

const MAX_BODY_BYTES = 8 * 1024;

export type BffDependencies = Readonly<{
  env: BffEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (line: string) => void;
  /** Development-only diagnostic hook. Receives a cURL with secrets masked. */
  debugCurl?: (curl: string) => void;
}>;

export type BffOperation = Readonly<{
  /** Stable name for logs; never includes values. */
  operation: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  backendPath: string;
  /** Registration routes carry the internal credential; the public catalog does not. */
  internal: boolean;
  requestSchema?: z.ZodType;
  responseSchema: z.ZodType;
  continuation: 'required' | 'none';
  idempotency: 'required' | 'optional' | 'none';
  originFingerprint?: boolean;
  /** `store`: move a rotated continuation into the cookie. `expire`: the flow ended on success. */
  onSuccess?: 'store' | 'expire';
}>;

type Envelope = Readonly<{
  data: Record<string, unknown>;
  message: string;
  statusCode: number;
}>;

const GENERIC_MESSAGES: Record<number, string> = {
  400: 'Invalid request.',
  401: 'Authentication is required.',
  403: 'Forbidden.',
  404: 'Resource not found.',
  409: 'The request conflicts with the current resource state.',
  422: 'The request could not be processed.',
  502: 'Upstream response was not understood.',
  503: 'Service is temporarily unavailable.',
};

function envelope(
  statusCode: number,
  data: Record<string, unknown> = {},
  message?: string,
): Envelope {
  return {
    data,
    message: message ?? GENERIC_MESSAGES[statusCode] ?? 'Request failed.',
    statusCode,
  };
}

export function jsonResponse(body: Envelope, cookies: readonly string[] = []): Response {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status: body.statusCode, headers });
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await request.text().catch(() => undefined);
  if (text === undefined || Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES)
    return { ok: false };
  try {
    return { ok: true, value: text.length === 0 ? {} : JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Keeps only what the contract publishes: success data validated against the expected schema,
 * and for 422 only a public `reason`. Anything else is replaced by a generic envelope.
 */
function translate(upstream: BackendResponse, operation: BffOperation): Envelope {
  if (upstream.status === 0) return envelope(503);
  const parsed = envelopeSchema.safeParse(upstream.body);
  if (upstream.status >= 200 && upstream.status < 300) {
    const data = parsed.success
      ? operation.responseSchema.safeParse(parsed.data.data)
      : undefined;
    if (!parsed.success || !data?.success) return envelope(502);
    return envelope(
      upstream.status,
      data.data as Record<string, unknown>,
      parsed.data.message,
    );
  }
  if (upstream.status === 422) {
    const reason = parsed.success
      ? errorReasonDataSchema.safeParse(parsed.data.data)
      : undefined;
    return envelope(
      422,
      reason?.success && reason.data.reason ? { reason: reason.data.reason } : {},
    );
  }
  if ([400, 401, 404, 409].includes(upstream.status)) return envelope(upstream.status);
  return envelope(503);
}

/**
 * Thin BFF adapter (ADR-022): same-origin + JSON checks, idempotency and body shape, cookie →
 * bearer, internal credential and fingerprint, then a single upstream call. It holds no business
 * rule and no per-request module state.
 */
export async function proxyRegistration(
  request: Request,
  operation: BffOperation,
  deps: BffDependencies,
): Promise<Response> {
  const started = performance.now();
  const correlationId = crypto.randomUUID();
  const { env } = deps;
  const finish = (body: Envelope, cookies: readonly string[] = []) => {
    logBffEvent(
      {
        operation: operation.operation,
        status: body.statusCode,
        durationMs: performance.now() - started,
        correlationId,
      },
      deps.log,
    );
    return jsonResponse(body, cookies);
  };

  const mutation = operation.method !== 'GET';
  if (mutation && (!hasTrustedOrigin(request, env) || !hasJsonContentType(request))) {
    return finish(envelope(403));
  }

  const idempotencyKey = readIdempotencyKey(request);
  if (idempotencyKey === undefined) return finish(envelope(400));
  if (operation.idempotency === 'required' && idempotencyKey === null)
    return finish(envelope(400));

  let body: unknown;
  if (operation.requestSchema) {
    const raw = await readJsonBody(request);
    const parsed = raw.ok ? operation.requestSchema.safeParse(raw.value) : undefined;
    if (!parsed?.success) return finish(envelope(400));
    body = parsed.data;
  }

  const continuation = readContinuationCookie(request.headers.get('cookie'), env);
  if (operation.continuation === 'required' && !continuation) {
    return finish(envelope(401), [expiredContinuationCookie(env)]);
  }

  let originFingerprint: string | undefined;
  if (operation.originFingerprint) {
    originFingerprint = resolveOriginFingerprint(request, env);
    if (!originFingerprint) return finish(envelope(400));
  }

  const backendRequest = {
    method: operation.method,
    path: operation.backendPath,
    body,
    internal: operation.internal,
    ...(operation.continuation === 'required' ? { continuation } : {}),
    ...(idempotencyKey && operation.idempotency !== 'none' ? { idempotencyKey } : {}),
    ...(originFingerprint ? { originFingerprint } : {}),
  } as const;
  const upstream = await callBackend(backendRequest, env, deps.fetchImpl);

  // const curl = buildBackendCurl(backendRequest, env);
  // console.info(curl)

  const result = translate(upstream, operation);
  const cookies: string[] = [];
  const succeeded = result.statusCode >= 200 && result.statusCode < 300;
  if (result.statusCode === 401 && operation.continuation === 'required') {
    cookies.push(expiredContinuationCookie(env));
  } else if (succeeded && operation.onSuccess === 'expire') {
    cookies.push(expiredContinuationCookie(env));
  } else if (succeeded && operation.onSuccess === 'store' && upstream.continuation) {
    const expiresAt =
      typeof result.data.expiresAt === 'string' ? result.data.expiresAt : undefined;
    cookies.push(
      serializeContinuationCookie(upstream.continuation, expiresAt, env, deps.now?.()),
    );
  }
  return finish(result, cookies);
}
