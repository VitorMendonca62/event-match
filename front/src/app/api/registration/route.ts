import { REGISTRATION_OPERATIONS } from '@/shared/server/registration-operations';
import { registrationHandler } from '@/shared/server/route-handler';

export const GET = registrationHandler(REGISTRATION_OPERATIONS.snapshot);

/**
 * Cancellation (ADR-030): the backend expires the registration like an abandoned one and revokes
 * the continuation; on success or `401` the HttpOnly cookie is expired here.
 */
export const DELETE = registrationHandler(REGISTRATION_OPERATIONS.cancel);
