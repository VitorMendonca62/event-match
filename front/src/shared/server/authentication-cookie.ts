import type { BffEnv } from '../config/bff-env.server';

/** Opaque session token issued by the backend: 32 bytes in base64url (ADR-033). */
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Upper bound of a remembered cookie, equal to the remembered absolute lifetime (ADR-034). */
export const REMEMBERED_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type CookieEnv = Pick<BffEnv, 'NODE_ENV'>;

/**
 * `__Host-` requires `Secure`, `Path=/` and no `Domain`; plain HTTP names exist only outside
 * production, and production cannot select them.
 */
export function sessionCookieName(env: CookieEnv): string {
  return env.NODE_ENV === 'production' ? '__Host-eventmatch_session' : 'eventmatch_session';
}

export function isSessionToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && SESSION_TOKEN_PATTERN.test(value);
}

export function readSessionCookie(cookieHeader: string | null, env: CookieEnv): string | undefined {
  if (!cookieHeader) return undefined;
  const name = sessionCookieName(env);
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return isSessionToken(value) ? value : undefined;
  }
  return undefined;
}

function attributes(env: CookieEnv, maxAge?: number): string {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  const age = maxAge === undefined ? '' : `; Max-Age=${maxAge}`;
  return `Path=/${age}; HttpOnly; SameSite=Lax${secure}`;
}

/**
 * Without “Manter conectado” the cookie has no `Max-Age`/`Expires` and ends with the browser
 * session; the backend still enforces 12 h / 30 min. A remembered cookie never outlives the
 * remaining absolute lifetime, capped at 30 days.
 */
export function serializeSessionCookie(
  token: string,
  session: Readonly<{ remembered: boolean; expiresAt: string }>,
  env: CookieEnv,
  now: Date = new Date(),
): string {
  if (!session.remembered) return `${sessionCookieName(env)}=${token}; ${attributes(env)}`;
  const remaining = Math.floor((Date.parse(session.expiresAt) - now.getTime()) / 1000);
  const maxAge = Number.isFinite(remaining)
    ? Math.min(Math.max(0, remaining), REMEMBERED_COOKIE_MAX_AGE_SECONDS)
    : 0;
  return `${sessionCookieName(env)}=${token}; ${attributes(env, maxAge)}`;
}

export function expiredSessionCookie(env: CookieEnv): string {
  return `${sessionCookieName(env)}=; ${attributes(env, 0)}`;
}
