import { getBffEnv } from '@/shared/config/bff-env.server';
import { confirmEmailLink } from '@/shared/server/confirm-link';

export async function GET(request: Request): Promise<Response> {
  return confirmEmailLink(request, { env: getBffEnv() });
}
