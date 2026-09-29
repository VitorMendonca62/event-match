import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

import type { BffEnv } from '../config/bff-env.server';

type FingerprintEnv = Pick<BffEnv, 'EDGE_PROVIDER' | 'ORIGIN_FINGERPRINT_KEY'>;

const VERCEL_HEADER = 'x-vercel-forwarded-for';
/** Local/test adapter: a fixed, explicitly non-production origin. */
const FIXTURE_ORIGIN = 'fixture-origin';

function normalizeIp(raw: string): string | undefined {
  const value = raw.trim().toLowerCase();
  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6) return undefined;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped?.[1] && isIP(mapped[1]) === 4) return mapped[1];
  return value;
}

function hmac(key: string, value: string): string {
  return createHmac('sha256', Buffer.from(key, 'base64')).update(value, 'utf8').digest('base64url');
}

/**
 * ADR-023: on Vercel only the platform header is trusted, and only when it carries a single valid
 * IP. `X-Forwarded-For`, `X-Real-IP` and other client-controlled headers are never a fallback. The
 * IP itself never leaves this function: only its keyed HMAC is forwarded.
 */
export function resolveOriginFingerprint(request: Request, env: FingerprintEnv): string | undefined {
  if (env.EDGE_PROVIDER === 'fixture') return hmac(env.ORIGIN_FINGERPRINT_KEY, FIXTURE_ORIGIN);
  const header = request.headers.get(VERCEL_HEADER);
  if (!header || header.includes(',')) return undefined;
  const ip = normalizeIp(header);
  return ip ? hmac(env.ORIGIN_FINGERPRINT_KEY, ip) : undefined;
}
