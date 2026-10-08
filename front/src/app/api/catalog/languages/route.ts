import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyLanguageCatalog } from '@/shared/server/catalog-bff';

export const GET = () => proxyLanguageCatalog({ env: getBffEnv() });
