import { authHandler } from '@/shared/server/auth-route-handler';
import { proxyLogout } from '@/shared/server/authentication-bff';

/** Logout (ADR-034): revokes upstream and always expires the local cookie. */
export const POST = authHandler('auth.logout', proxyLogout);
