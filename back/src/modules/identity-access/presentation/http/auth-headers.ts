import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { readOpaqueBearer } from '../../../../shared/presentation/http/bff-headers';

/**
 * New or rotated session token (ADR-034). Internal to the BFF hop: the BFF moves it into the
 * HttpOnly cookie and never forwards this header or its value to the browser.
 */
export const SESSION_RESPONSE_HEADER = 'X-EventMatch-Session';

/** Session bearer, shape-checked only; the use case resolves it by digest. */
export const SessionBearer = createParamDecorator((_: unknown, context: ExecutionContext): string => {
  const token = readOpaqueBearer(context.switchToHttp().getRequest<Request>());
  if (!token) throw new UnauthorizedException();
  return token;
});
