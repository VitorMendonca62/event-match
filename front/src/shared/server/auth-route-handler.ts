import { type BffEnv, getBffEnv } from '../config/bff-env.server';
import type { AuthBffDependencies } from './authentication-bff';
import { jsonResponse } from './bff-proxy';

type AuthProxy = (request: Request, deps: AuthBffDependencies) => Promise<Response>;

/**
 * Binds a Route Handler to one auth BFF operation. A configuration failure answers a generic 503
 * and is reported without values; the env schema never echoes secrets.
 */
export function authHandler(operation: string, proxy: AuthProxy) {
  return async function handler(request: Request): Promise<Response> {
    let env: BffEnv;
    try {
      env = getBffEnv();
    } catch {
      console.error(JSON.stringify({ scope: 'auth-bff', operation, error: 'config' }));
      return jsonResponse({ data: {}, message: 'Service is temporarily unavailable.', statusCode: 503 });
    }
    return proxy(request, { env });
  };
}
