import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { readOpaqueBearer, singleHeader } from '../../../../shared/presentation/http/bff-headers';

export {
  BFF_TOKEN_HEADER,
  isOpaqueToken,
  ORIGIN_FINGERPRINT_HEADER,
  OriginFingerprint,
} from '../../../../shared/presentation/http/bff-headers';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
/** Rotated continuation; the BFF moves it into an HttpOnly cookie and strips it (ADR-022). */
export const CONTINUATION_RESPONSE_HEADER = 'X-Registration-Continuation';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

/** Bearer continuation, shape-checked only; the use case resolves and locks the session. */
export function readContinuation(request: Request): string {
  const token = readOpaqueBearer(request);
  if (!token) throw new UnauthorizedException();
  return token;
}

export const Continuation = createParamDecorator((_: unknown, context: ExecutionContext): string =>
  readContinuation(context.switchToHttp().getRequest<Request>()),
);

export const IdempotencyKey = createParamDecorator(
  (options: { required: boolean } | undefined, context: ExecutionContext): string | undefined => {
    const value = singleHeader(context.switchToHttp().getRequest<Request>(), IDEMPOTENCY_KEY_HEADER);
    if (value === undefined && !options?.required) return undefined;
    if (value === undefined || !IDEMPOTENCY_KEY.test(value)) throw new BadRequestException();
    return value;
  },
);
