import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/** Internal headers of the BFF → NestJS hop (ADR-021, ADR-023). Never sent to browsers. */
export const BFF_TOKEN_HEADER = 'x-eventmatch-bff-token';
export const ORIGIN_FINGERPRINT_HEADER = 'x-eventmatch-origin-fingerprint';
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
/** Rotated continuation; the BFF moves it into an HttpOnly cookie and strips it (ADR-022). */
export const CONTINUATION_RESPONSE_HEADER = 'X-Registration-Continuation';

/** 32 bytes in base64url without padding. */
const OPAQUE_32_BYTES = /^[A-Za-z0-9_-]{43}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

export function isOpaqueToken(value: string): boolean {
  return OPAQUE_32_BYTES.test(value);
}

function singleHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value.trim() : undefined;
}

/** Bearer continuation, shape-checked only; the use case resolves and locks the session. */
export function readContinuation(request: Request): string {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(singleHeader(request, 'authorization') ?? '');
  if (!match) throw new UnauthorizedException();
  return match[1];
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

/** Validates only shape and size; the backend never rebuilds it from public headers (ADR-023). */
export const OriginFingerprint = createParamDecorator((_: unknown, context: ExecutionContext): Buffer => {
  const value = singleHeader(context.switchToHttp().getRequest<Request>(), ORIGIN_FINGERPRINT_HEADER);
  if (value === undefined || !OPAQUE_32_BYTES.test(value)) throw new BadRequestException();
  return Buffer.from(value, 'base64url');
});
