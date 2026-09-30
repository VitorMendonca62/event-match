import type { BffEnv } from '../../src/shared/config/bff-env.server';

export const SECRET = Buffer.alloc(32, 7).toString('base64');
export const TOKEN = 'A'.repeat(43);
export const ROTATED = 'B'.repeat(43);
export const KEY = '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50';

export function testEnv(overrides: Partial<BffEnv> = {}): BffEnv {
  return {
    NODE_ENV: 'test',
    BACKEND_INTERNAL_URL: 'http://backend.test',
    FRONTEND_PUBLIC_URL: 'http://app.test',
    BFF_INTERNAL_TOKEN: SECRET,
    ORIGIN_FINGERPRINT_KEY: Buffer.alloc(32, 9).toString('base64'),
    EDGE_PROVIDER: 'fixture',
    BACKEND_TIMEOUT_MS: 1000,
    AUTH_UI_ENABLED: true,
    ...overrides,
  };
}

export type Captured = { url: string; init: RequestInit & { headers: Headers } };

/** Fake NestJS: records every call and answers with the given envelope. */
export function fakeBackend(
  status: number,
  data: object = {},
  headers: Record<string, string> = {},
): { fetchImpl: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchImpl = (async (url: string, init: RequestInit & { headers: Headers }) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ data, message: 'upstream', statusCode: status }), { status, headers });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

export function browserRequest(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string>; cookie?: string } = {},
): Request {
  const headers = new Headers({
    origin: 'http://app.test',
    'content-type': 'application/json',
    'idempotency-key': KEY,
    ...init.headers,
  });
  if (init.cookie) headers.set('cookie', init.cookie);
  return new Request(`http://app.test${path}`, {
    method: init.method ?? 'POST',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
