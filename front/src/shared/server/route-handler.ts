import { getBffEnv } from '../config/bff-env.server';
import { type BffOperation, jsonResponse, proxyRegistration } from './bff-proxy';

/**
 * Binds a Route Handler to one operation. A configuration failure answers a generic 503 and is
 * reported without values; the env schema never echoes secrets.
 */
export function registrationHandler(operation: BffOperation) {
  return async function handler(request: Request): Promise<Response> {
    let env;
    try {
      env = getBffEnv();
    } catch {
      console.error(JSON.stringify({ scope: 'registration-bff', operation: operation.operation, error: 'config' }));
      return jsonResponse({ data: {}, message: 'Service is temporarily unavailable.', statusCode: 503 });
    }
    return proxyRegistration(request, operation, { env });
  };
}
