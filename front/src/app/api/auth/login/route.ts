import { authHandler } from '@/shared/server/auth-route-handler';
import { proxyLogin } from '@/shared/server/authentication-bff';

/** Login (ADR-034): same-origin JSON only; the session becomes an HttpOnly cookie. */
export const POST = authHandler('auth.login', proxyLogin);
