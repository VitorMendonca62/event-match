import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ProfileRequest } from './profile-auth.guard';

export const ProfileAccountId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const accountId = context.switchToHttp().getRequest<ProfileRequest>().profilePrincipal?.accountId;
  if (!accountId) throw new Error('Profile principal was not resolved.');
  return accountId;
});
