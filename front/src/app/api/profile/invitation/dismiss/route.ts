import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyProfileInvitationDismiss } from '@/shared/server/profile-bff';

export const POST = (request: Request) =>
  proxyProfileInvitationDismiss(request, { env: getBffEnv() });
