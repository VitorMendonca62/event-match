import type { BffEnv } from '../config/bff-env.server';

type OriginEnv = Pick<BffEnv, 'FRONTEND_PUBLIC_URL'>;

/**
 * CSRF barrier of the BFF (ADR-022): the browser must send exactly one `Origin` equal to the
 * configured public origin. A missing, repeated or foreign origin is refused before any upstream
 * call. CORS is never enabled, so cross-origin reads fail in the browser as well.
 */
export function hasTrustedOrigin(request: Request, env: OriginEnv): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin.includes(',')) return false;
  if (origin !== new URL(env.FRONTEND_PUBLIC_URL).origin) return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite === null || fetchSite === 'same-origin';
}

export function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get('content-type');
  if (!contentType) return false;
  return contentType.split(';')[0]?.trim().toLowerCase() === 'application/json';
}
