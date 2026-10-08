import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyFederativeUnitCatalog } from '@/shared/server/catalog-bff';

export const GET = () => proxyFederativeUnitCatalog({ env: getBffEnv() });
