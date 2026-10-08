import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ProfileError } from '../../domain/errors/profile.error';

const STATUS = {
  PROFILE_NOT_FOUND: HttpStatus.NOT_FOUND,
  PROFILE_REVISION_CONFLICT: HttpStatus.CONFLICT,
  INVALID_PROFILE_CONTENT: HttpStatus.BAD_REQUEST,
  INVALID_LOCATION: HttpStatus.BAD_REQUEST,
  INACTIVE_INTEREST: HttpStatus.BAD_REQUEST,
  UNKNOWN_LANGUAGE: HttpStatus.UNPROCESSABLE_ENTITY,
  INACTIVE_LANGUAGE: HttpStatus.UNPROCESSABLE_ENTITY,
  UNKNOWN_ACTIVITY_PREFERENCE: HttpStatus.UNPROCESSABLE_ENTITY,
  INACTIVE_ACTIVITY_PREFERENCE: HttpStatus.UNPROCESSABLE_ENTITY,
  PHOTO_UPLOAD_EXPIRED: HttpStatus.GONE,
  PHOTO_REJECTED: HttpStatus.UNPROCESSABLE_ENTITY,
  MEDIA_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  MEDIA_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
} as const;
const MESSAGE: Record<keyof typeof STATUS, string> = {
  PROFILE_NOT_FOUND: 'Profile not found.', PROFILE_REVISION_CONFLICT: 'Profile changed. Reload before saving again.',
  INVALID_PROFILE_CONTENT: 'Profile content is invalid.', INVALID_LOCATION: 'The selected municipality is not available for this state.', INACTIVE_INTEREST: 'One or more interests are unavailable.',
  UNKNOWN_LANGUAGE: 'One or more languages are unknown.', INACTIVE_LANGUAGE: 'One or more languages are inactive.',
  UNKNOWN_ACTIVITY_PREFERENCE: 'One or more activity preferences are unknown.',
  INACTIVE_ACTIVITY_PREFERENCE: 'One or more activity preferences are inactive.',
  PHOTO_UPLOAD_EXPIRED: 'Photo upload expired.', PHOTO_REJECTED: 'Photo was rejected.',
  MEDIA_RATE_LIMITED: 'Too many media requests.', MEDIA_UNAVAILABLE: 'Media service is temporarily unavailable.',
};

@Catch(ProfileError)
export class ProfileErrorFilter implements ExceptionFilter {
  catch(error: ProfileError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS[error.code];
    response.status(statusCode).json({ data: error.reason ? { reason: error.reason } : {}, message: MESSAGE[error.code], statusCode });
  }
}
