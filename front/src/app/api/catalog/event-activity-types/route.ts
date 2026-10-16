import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyEventActivityTypeCatalog } from '@/shared/server/catalog-bff';

export const dynamic = 'force-dynamic';
export const GET = () => proxyEventActivityTypeCatalog({ env: getBffEnv() });
