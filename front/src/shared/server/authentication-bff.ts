import 'server-only';

import type { z } from 'zod';

import {
  loggedOutSchema,
  loginRequestSchema,
  sessionDeadlinesSchema,
  sessionStateSchema,
} from '../../features/authentication/contracts';
import { envelopeSchema } from '../../features/registration/contracts';
import type { BffEnv } from '../config/bff-env.server';
import { type BackendResponse, callBackend } from './backend-client';
import { jsonResponse } from './bff-proxy';
import { logBffEvent } from './bff-logger';
import { expiredSessionCookie, readSessionCookie, serializeSessionCookie } from './authentication-cookie';
import { resolveOriginFingerprint } from './origin-fingerprint';
import { hasJsonContentType, hasTrustedOrigin } from './same-origin';

const MAX_BODY_BYTES = 2 * 1024;

export type AuthBffDependencies = Readonly<{
  env: BffEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (line: string) => void;
}>;

type Envelope = Readonly<{ data: Record<string, unknown>; message: string; statusCode: number }>;

const MESSAGES: Record<number, string> = {
  200: 'Request completed successfully.',
  400: 'Invalid request.',
  401: 'Authentication is required.',
  403: 'Forbidden.',
  404: 'Resource not found.',
  429: 'Too many requests.',
  502: 'Upstream response was not understood.',
  503: 'Service is temporarily unavailable.',
};

function envelope(statusCode: number, data: Record<string, unknown> = {}): Envelope {
  return { data, message: MESSAGES[statusCode] ?? 'Request failed.', statusCode };
}

/** Success data of the upstream envelope, or `undefined` when the shape is not the published one. */
function upstreamData<T>(upstream: BackendResponse, schema: z.ZodType<T>): T | undefined {
  const parsed = envelopeSchema.safeParse(upstream.body);
  if (!parsed.success) return undefined;
  const data = schema.safeParse(parsed.data.data);
  return data.success ? data.data : undefined;
}

/**
 * Same-site guard for the session maintenance GET: it may rotate the cookie, so only the page
 * itself may trigger it. Browsers that omit `Sec-Fetch-Site` are treated as same-origin.
 */
function isSameSiteFetch(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin';
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text().catch(() => undefined);
  if (text === undefined || Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function tracker(operation: string, deps: AuthBffDependencies) {
  const started = performance.now();
  const correlationId = crypto.randomUUID();
  return (body: Envelope, cookies: readonly string[] = []) => {
    logBffEvent(
      { scope: 'auth-bff', operation, status: body.statusCode, durationMs: performance.now() - started, correlationId },
      deps.log,
    );
    return jsonResponse(body, cookies);
  };
}

/**
 * POST /api/auth/login (ADR-034). Same-origin JSON only (login CSRF), shape-checked body, origin
 * fingerprint, one upstream call without retry. The token becomes the HttpOnly cookie and never
 * appears in the JSON; refusals stay neutral.
 */
export async function proxyLogin(request: Request, deps: AuthBffDependencies): Promise<Response> {
  const finish = tracker('auth.login', deps);
  const { env } = deps;
  if (!env.AUTH_UI_ENABLED) return finish(envelope(404));
  if (!hasTrustedOrigin(request, env) || !hasJsonContentType(request)) return finish(envelope(403));

  const parsed = loginRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return finish(envelope(400));
  const originFingerprint = resolveOriginFingerprint(request, env);
  if (!originFingerprint) return finish(envelope(400));

  const upstream = await callBackend(
    { method: 'POST', path: '/auth/login', body: parsed.data, internal: true, originFingerprint },
    env,
    deps.fetchImpl,
  );

  if (upstream.status === 200) {
    const deadlines = upstreamData(upstream, sessionDeadlinesSchema);
    if (!deadlines || !upstream.session) return finish(envelope(502));
    return finish(envelope(200, { authenticated: true }), [
      serializeSessionCookie(upstream.session, deadlines, env, deps.now?.()),
    ]);
  }
  if ([400, 401, 429].includes(upstream.status)) return finish(envelope(upstream.status));
  return finish(envelope(503));
}

/**
 * GET /api/auth/session: the page's maintenance call on focus/visibility (ADR-034). It lets the
 * backend rotate a due remembered session and moves the new token into the cookie. `401` expires
 * the cookie; `403` keeps it (ADR-036). A failure never extends nor drops a valid session.
 */
export async function proxySessionMaintenance(request: Request, deps: AuthBffDependencies): Promise<Response> {
  const finish = tracker('auth.session', deps);
  const { env } = deps;
  const expired = expiredSessionCookie(env);
  if (!env.AUTH_UI_ENABLED) return finish(envelope(404), [expired]);
  if (!isSameSiteFetch(request)) return finish(envelope(403));

  const session = readSessionCookie(request.headers.get('cookie'), env);
  if (!session) return finish(envelope(401), [expired]);

  const upstream = await callBackend(
    { method: 'GET', path: '/auth/session?capability=authenticated_home&rotate=true', internal: true, session },
    env,
    deps.fetchImpl,
  );

  if (upstream.status === 200) {
    const state = upstreamData(upstream, sessionStateSchema);
    if (!state) return finish(envelope(502));
    const cookies = upstream.session ? [serializeSessionCookie(upstream.session, state, env, deps.now?.())] : [];
    return finish(envelope(200, { authenticated: true }), cookies);
  }
  if (upstream.status === 401) return finish(envelope(401), [expired]);
  if (upstream.status === 403) return finish(envelope(403));
  return finish(envelope(503));
}

/**
 * POST /api/auth/logout: revokes upstream when a cookie exists and always expires the local cookie,
 * even when the session was already gone or the backend is unavailable (ADR-034). Still reachable
 * with the UI flag off, so a rollback can clear cookies left in browsers.
 */
export async function proxyLogout(request: Request, deps: AuthBffDependencies): Promise<Response> {
  const finish = tracker('auth.logout', deps);
  const { env } = deps;
  if (!hasTrustedOrigin(request, env) || !hasJsonContentType(request)) return finish(envelope(403));
  const expired = expiredSessionCookie(env);

  const session = readSessionCookie(request.headers.get('cookie'), env);
  if (!session) return finish(envelope(200, { loggedOut: true }), [expired]);

  const upstream = await callBackend(
    { method: 'POST', path: '/auth/logout', internal: true, session, body: {} },
    env,
    deps.fetchImpl,
  );
  const done = upstream.status === 401 || (upstream.status === 200 && upstreamData(upstream, loggedOutSchema));
  return finish(done ? envelope(200, { loggedOut: true }) : envelope(503), [expired]);
}
