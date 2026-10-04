import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyPhotoMutation } from '@/shared/server/profile-bff';
export const POST = (request: Request) => proxyPhotoMutation(request, 'grant', undefined, { env: getBffEnv() });
