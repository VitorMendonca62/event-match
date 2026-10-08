import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyInterestCatalog } from '@/shared/server/catalog-bff';

export const GET = () => proxyInterestCatalog({ env: getBffEnv() });
