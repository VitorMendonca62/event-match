import type { BffEnv } from '../config/bff-env.server';
import { isContinuationToken } from './continuation-cookie';

type BackendEnv = Pick<BffEnv, 'BACKEND_INTERNAL_URL' | 'BFF_INTERNAL_TOKEN' | 'BACKEND_TIMEOUT_MS'>;

export const BFF_TOKEN_HEADER = 'x-eventmatch-bff-token';
export const ORIGIN_FINGERPRINT_HEADER = 'x-eventmatch-origin-fingerprint';
export const CONTINUATION_RESPONSE_HEADER = 'x-registration-continuation';
/** New or rotated session token (ADR-034); read here and never copied to the browser. */
export const SESSION_RESPONSE_HEADER = 'x-eventmatch-session';

/** Opaque 32-byte tokens in base64url: continuation and session share the same shape. */
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export type BackendRequest = Readonly<{
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path under `/api/v1`, including an allowlisted query when needed. */
  path: string;
  body?: unknown;
  continuation?: string;
  /** Authenticated session token (ADR-033); mutually exclusive with `continuation`. */
  session?: string;
  idempotencyKey?: string;
  originFingerprint?: string;
  /** Registration routes require the internal BFF credential; the public catalog does not. */
  internal: boolean;
}>;

/** `status: 0` means the backend never answered (network failure or timeout). */
export type BackendResponse = Readonly<{
  status: number;
  body: unknown;
  continuation?: string;
  session?: string;
}>;

export type CurlDebugOptions = Readonly<{
  /** Explicitly opt in only for a local terminal. The default never serializes secrets. */
  includeSecrets?: boolean;
}>;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\\"'\\\"'")}'`;
}

/**
 * Builds the exact cURL shape sent by this server-only client to NestJS. It is diagnostic-only:
 * callers must opt in before a continuation or BFF token is included.
 */
export function buildBackendCurl(
  request: BackendRequest,
  env: BackendEnv,
  options: CurlDebugOptions = {},
): string {
  const reveal = options.includeSecrets === true;
  const headers = ['Accept: application/json'];
  if (request.internal) {
    headers.push(`${BFF_TOKEN_HEADER}: ${reveal ? env.BFF_INTERNAL_TOKEN : '<BFF_INTERNAL_TOKEN>'}`);
  }
  if (request.continuation) {
    headers.push(`Authorization: Bearer ${reveal ? request.continuation : '<REGISTRATION_CONTINUATION>'}`);
  }
  if (request.session) {
    headers.push(`Authorization: Bearer ${reveal ? request.session : '<AUTHENTICATED_SESSION>'}`);
  }
  if (request.idempotencyKey) headers.push(`Idempotency-Key: ${request.idempotencyKey}`);
  if (request.originFingerprint) {
    headers.push(`${ORIGIN_FINGERPRINT_HEADER}: ${reveal ? request.originFingerprint : '<ORIGIN_FINGERPRINT>'}`);
  }
  if (request.body !== undefined) headers.push('Content-Type: application/json');

  const parts = [
    'curl --fail-with-body --show-error --silent',
    `--request ${request.method}`,
    ...headers.map((header) => `--header ${shellQuote(header)}`),
    request.body === undefined ? undefined : `--data-raw ${shellQuote(JSON.stringify(request.body))}`,
    shellQuote(`${env.BACKEND_INTERNAL_URL}/api/v1${request.path}`),
  ].filter((part): part is string => Boolean(part));
  return parts.join(' \\\n  ');
}

/**
 * Server-only client of the NestJS contract v1. One attempt per call: no implicit retry, bounded by
 * a timeout, never cached. Internal headers are added here and never copied back to the browser.
 */
export async function callBackend(
  request: BackendRequest,
  env: BackendEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<BackendResponse> {
  const headers = new Headers({ accept: 'application/json' });
  if (request.internal) headers.set(BFF_TOKEN_HEADER, env.BFF_INTERNAL_TOKEN);
  if (request.continuation) headers.set('authorization', `Bearer ${request.continuation}`);
  if (request.session) headers.set('authorization', `Bearer ${request.session}`);
  if (request.idempotencyKey) headers.set('idempotency-key', request.idempotencyKey);
  if (request.originFingerprint) headers.set(ORIGIN_FINGERPRINT_HEADER, request.originFingerprint);
  if (request.body !== undefined) headers.set('content-type', 'application/json');

  try {
    const response = await fetchImpl(`${env.BACKEND_INTERNAL_URL}/api/v1${request.path}`, {
      method: request.method,
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(env.BACKEND_TIMEOUT_MS),
    });
    const body: unknown = await response.json().catch(() => undefined);
    const continuation = response.headers.get(CONTINUATION_RESPONSE_HEADER);
    const session = response.headers.get(SESSION_RESPONSE_HEADER);
    return {
      status: response.status,
      body,
      ...(isContinuationToken(continuation) ? { continuation } : {}),
      ...(session && OPAQUE_TOKEN.test(session) ? { session } : {}),
    };
  } catch {
    return { status: 0, body: undefined };
  }
}
