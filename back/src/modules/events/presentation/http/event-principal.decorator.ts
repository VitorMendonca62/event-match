import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { EventsRequest } from './events-auth.guard';

export const EventAccountId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const accountId = context.switchToHttp().getRequest<EventsRequest>().eventsPrincipal?.accountId;
  if (!accountId) throw new Error('Event principal was not resolved.');
  return accountId;
});
