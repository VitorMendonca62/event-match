import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyProfilePreview } from '@/shared/server/profile-bff';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => proxyProfilePreview(request, { env: getBffEnv() });
