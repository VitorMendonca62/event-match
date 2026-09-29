import { registrationHandler } from '@/shared/server/route-handler';
import { REGISTRATION_OPERATIONS } from '@/shared/server/registration-operations';

export const POST = registrationHandler(REGISTRATION_OPERATIONS.complete);
