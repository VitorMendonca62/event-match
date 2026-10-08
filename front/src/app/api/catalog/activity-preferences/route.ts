import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyActivityPreferenceCatalog } from '@/shared/server/catalog-bff';

export const GET = () => proxyActivityPreferenceCatalog({ env: getBffEnv() });
