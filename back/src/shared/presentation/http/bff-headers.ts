import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Internal headers of the BFF → NestJS hop (ADR-021, ADR-023). Never sent to browsers. */
export const BFF_TOKEN_HEADER = 'x-eventmatch-bff-token';
export const ORIGIN_FINGERPRINT_HEADER = 'x-eventmatch-origin-fingerprint';

/** 32 bytes in base64url without padding: continuation, session token and origin fingerprint. */
const OPAQUE_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

export function isOpaqueToken(value: string): boolean {
  return OPAQUE_32_BYTES.test(value);
}

export function singleHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value.trim() : undefined;
}

/** Opaque bearer, shape-checked only; `undefined` when absent or malformed. */
export function readOpaqueBearer(request: Request): string | undefined {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(singleHeader(request, 'authorization') ?? '');
  return match?.[1];
}

/** Validates only shape and size; the backend never rebuilds it from public headers (ADR-023). */
export const OriginFingerprint = createParamDecorator((_: unknown, context: ExecutionContext): Buffer => {
  const value = singleHeader(context.switchToHttp().getRequest<Request>(), ORIGIN_FINGERPRINT_HEADER);
  if (value === undefined || !OPAQUE_32_BYTES.test(value)) throw new BadRequestException();
  return Buffer.from(value, 'base64url');
});
