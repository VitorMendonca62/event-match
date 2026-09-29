import type { BffEnv } from '../config/bff-env.server';

/** Opaque continuation issued by the backend: 32 bytes in base64url (ADR-021). */
const CONTINUATION_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Upper bound for a cookie whose response did not carry `expiresAt` (eligibility and contact
 * confirmation). The backend remains the authority on expiry; this only bounds browser storage.
 */
export const FALLBACK_COOKIE_MAX_AGE_SECONDS = 60 * 60;

type CookieEnv = Pick<BffEnv, 'NODE_ENV'>;

/** `__Host-` requires `Secure`; plain HTTP is allowed only outside production (plan §4.2). */
export function continuationCookieName(env: CookieEnv): string {
  return env.NODE_ENV === 'production' ? '__Host-eventmatch_registration' : 'eventmatch_registration';
}

export function isContinuationToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && CONTINUATION_PATTERN.test(value);
}

export function readContinuationCookie(cookieHeader: string | null, env: CookieEnv): string | undefined {
  if (!cookieHeader) return undefined;
  const name = continuationCookieName(env);
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return isContinuationToken(value) ? value : undefined;
  }
  return undefined;
}

function attributes(env: CookieEnv, maxAge: number): string {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function maxAgeUntil(expiresAt: string | undefined, now: Date): number {
  if (!expiresAt) return FALLBACK_COOKIE_MAX_AGE_SECONDS;
  const seconds = Math.floor((Date.parse(expiresAt) - now.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return FALLBACK_COOKIE_MAX_AGE_SECONDS;
  return Math.max(0, seconds);
}

export function serializeContinuationCookie(
  token: string,
  expiresAt: string | undefined,
  env: CookieEnv,
  now: Date = new Date(),
): string {
  return `${continuationCookieName(env)}=${token}; ${attributes(env, maxAgeUntil(expiresAt, now))}`;
}

export function expiredContinuationCookie(env: CookieEnv): string {
  return `${continuationCookieName(env)}=; ${attributes(env, 0)}`;
}
