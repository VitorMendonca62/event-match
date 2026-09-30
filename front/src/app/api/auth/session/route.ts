import { authHandler } from '@/shared/server/auth-route-handler';
import { proxySessionMaintenance } from '@/shared/server/authentication-bff';

/** Session maintenance (ADR-034): validates, rotates a due remembered session, never cached. */
export const GET = authHandler('auth.session', proxySessionMaintenance);
