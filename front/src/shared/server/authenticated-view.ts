import { cookies } from 'next/headers';

import { sessionStateSchema } from '../../features/authentication/contracts';
import { envelopeSchema } from '../../features/registration/contracts';
import { type BffEnv, getBffEnv } from '../config/bff-env.server';
import { isSessionToken, sessionCookieName } from './authentication-cookie';
import { callBackend } from './backend-client';

/**
 * What an RSC may know about the visitor: a coarse state only. No account id, status, deadline or
 * token crosses into props (`server-serialization`, ADR-036).
 */
export type SessionView = 'authenticated' | 'anonymous' | 'forbidden' | 'unavailable';

type Deps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>;

/**
 * Validates the session server-side before any protected content is rendered (ADR-034). It never
 * rotates: RSC cannot set cookies, so rotation belongs to the BFF maintenance call.
 */
export async function resolveSessionView(token: string | undefined, deps: Deps): Promise<SessionView> {
  if (!token) return 'anonymous';
  const upstream = await callBackend(
    { method: 'GET', path: '/auth/session?capability=authenticated_home', internal: true, session: token },
    deps.env,
    deps.fetchImpl,
  );
  if (upstream.status === 401) return 'anonymous';
  if (upstream.status === 403) return 'forbidden';
  const envelope = envelopeSchema.safeParse(upstream.body);
  const valid = upstream.status === 200 && envelope.success && sessionStateSchema.safeParse(envelope.data.data).success;
  return valid ? 'authenticated' : 'unavailable';
}

/**
 * Reads the request cookie first, so the route becomes dynamic before server-only configuration is
 * touched, then resolves the session. `enabled: false` means the auth UI is rolled back.
 */
export async function currentSessionView(): Promise<{ enabled: boolean; view: SessionView }> {
  const cookieStore = await cookies();
  const env = getBffEnv();
  if (!env.AUTH_UI_ENABLED) return { enabled: false, view: 'anonymous' };
  const token = cookieStore.get(sessionCookieName(env))?.value;
  return { enabled: true, view: await resolveSessionView(isSessionToken(token) ? token : undefined, { env }) };
}
