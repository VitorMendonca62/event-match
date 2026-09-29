import { registrationHandler } from '@/shared/server/route-handler';
import { REGISTRATION_OPERATIONS } from '@/shared/server/registration-operations';

export const PUT = registrationHandler(REGISTRATION_OPERATIONS.password);
