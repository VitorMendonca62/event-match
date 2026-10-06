import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyActivityPreferenceCatalog } from '@/shared/server/profile-bff';

export function GET(): Promise<Response> {
  return proxyActivityPreferenceCatalog({ env: getBffEnv() });
}
