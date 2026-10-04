import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyPhotoMutation } from '@/shared/server/profile-bff';
export const DELETE = (request: Request) => proxyPhotoMutation(request, 'remove', undefined, { env: getBffEnv() });
