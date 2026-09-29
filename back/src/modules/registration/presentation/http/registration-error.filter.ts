import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { ApiResponseDto } from '../../../../shared/presentation/http/api-response.dto';
import { RegistrationError, type RegistrationErrorCode } from '../../domain/errors/registration.error';

/**
 * Typed translation of application errors (ADR-020). Messages are fixed per status and never echo
 * input, so a refusal cannot reveal whether a contact or account exists.
 */
const STATUS: Record<RegistrationErrorCode, HttpStatus> = {
  INVALID_CONTACT: HttpStatus.UNPROCESSABLE_ENTITY,
  WHATSAPP_CONSENT_REQUIRED: HttpStatus.BAD_REQUEST,
  INVALID_PASSWORD: HttpStatus.UNPROCESSABLE_ENTITY,
  WEAK_PASSWORD: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_BIRTH_DATE: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_DISPLAY_NAME: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_REGION: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_USAGE_INTENTS: HttpStatus.UNPROCESSABLE_ENTITY,
  ACCOUNT_CANNOT_BE_ACTIVATED: HttpStatus.UNPROCESSABLE_ENTITY,
  FLOW_UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FLOW_STAGE_CONFLICT: HttpStatus.CONFLICT,
  IDEMPOTENCY_CONFLICT: HttpStatus.CONFLICT,
  VERIFICATION_UNAVAILABLE: HttpStatus.CONFLICT,
  REGISTRATION_UNAVAILABLE: HttpStatus.CONFLICT,
  CONTACT_UNAVAILABLE: HttpStatus.CONFLICT,
  INVALID_LEGAL_DOCUMENT: HttpStatus.INTERNAL_SERVER_ERROR,
};

const MESSAGES: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Invalid request.',
  [HttpStatus.UNAUTHORIZED]: 'Authentication is required.',
  [HttpStatus.CONFLICT]: 'The request conflicts with the current resource state.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'The request could not be processed.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'The request could not be completed.',
};

/** The client-facing reason for 422s, limited to codes that disclose nothing about other people. */
const REASONS: Partial<Record<RegistrationErrorCode, string>> = {
  INVALID_CONTACT: 'invalid_contact',
  INVALID_PASSWORD: 'invalid_password',
  WEAK_PASSWORD: 'weak_password',
  INVALID_BIRTH_DATE: 'invalid_birth_date',
  INVALID_DISPLAY_NAME: 'invalid_display_name',
  INVALID_REGION: 'invalid_region',
  INVALID_USAGE_INTENTS: 'invalid_usage_intents',
  ACCOUNT_CANNOT_BE_ACTIVATED: 'activation_unavailable',
};

export function registrationErrorStatus(code: RegistrationErrorCode): HttpStatus {
  return STATUS[code];
}

@Catch(RegistrationError)
export class RegistrationErrorFilter implements ExceptionFilter {
  catch(error: RegistrationError, host: ArgumentsHost): void {
    const statusCode = STATUS[error.code];
    const reason = REASONS[error.code];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json(new ApiResponseDto(reason ? { reason } : {}, MESSAGES[statusCode] ?? 'Invalid request.', statusCode));
  }
}
