import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyProfile } from '@/shared/server/profile-bff';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => proxyProfile(request, { env: getBffEnv() });
export const PUT = (request: Request) => proxyProfile(request, { env: getBffEnv() });
