import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyMunicipalityCatalog } from '@/shared/server/catalog-bff';

export const GET = (request: Request) => proxyMunicipalityCatalog(request, { env: getBffEnv() });
