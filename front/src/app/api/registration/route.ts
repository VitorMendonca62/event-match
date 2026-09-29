import { getBffEnv } from '@/shared/config/bff-env.server';
import { jsonResponse } from '@/shared/server/bff-proxy';
import { expiredContinuationCookie } from '@/shared/server/continuation-cookie';
import { registrationHandler } from '@/shared/server/route-handler';
import { REGISTRATION_OPERATIONS } from '@/shared/server/registration-operations';
import { hasTrustedOrigin } from '@/shared/server/same-origin';

export const GET = registrationHandler(REGISTRATION_OPERATIONS.snapshot);

/**
 * Local cancellation: expires the HttpOnly continuation. The contract has no server-side revocation
 * endpoint yet, so the backend session simply expires on its own TTL (SDD-010 §4.1).
 */
export async function DELETE(request: Request): Promise<Response> {
  const env = getBffEnv();
  if (!hasTrustedOrigin(request, env)) {
    return jsonResponse({ data: {}, message: 'Forbidden.', statusCode: 403 });
  }
  return jsonResponse({ data: {}, message: 'Cadastro cancelado.', statusCode: 200 }, [expiredContinuationCookie(env)]);
}
