import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { ApiResponseDto } from '../../../../shared/presentation/http/api-response.dto';
import { IdentityAccessError, type IdentityAccessErrorCode } from '../../domain/errors/identity-access.error';

/**
 * Neutral translation (ADR-035, ADR-036). Every "no usable session or credential" code becomes the
 * same 401 body — byte for byte the one the global filter emits — and 429/403 are generic: no
 * bucket, remaining attempts, release time, account state or reason is ever disclosed.
 */
const STATUS: Record<IdentityAccessErrorCode, HttpStatus> = {
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  SESSION_EXPIRED: HttpStatus.UNAUTHORIZED,
  SESSION_REVOKED: HttpStatus.UNAUTHORIZED,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  CAPABILITY_DENIED: HttpStatus.FORBIDDEN,
};

const MESSAGES: Record<number, string> = {
  [HttpStatus.UNAUTHORIZED]: 'Authentication is required.',
  [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests.',
};

export function identityAccessErrorStatus(code: IdentityAccessErrorCode): HttpStatus {
  return STATUS[code];
}

@Catch(IdentityAccessError)
export class IdentityAccessErrorFilter implements ExceptionFilter {
  catch(error: IdentityAccessError, host: ArgumentsHost): void {
    const statusCode = STATUS[error.code];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json(new ApiResponseDto({}, MESSAGES[statusCode] ?? 'Invalid request.', statusCode));
  }
}
