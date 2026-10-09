import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { EventError } from '../../domain/errors/event.error';

const STATUS: Record<EventError['code'], HttpStatus> = {
  EVENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  EVENT_REVISION_CONFLICT: HttpStatus.CONFLICT,
  EVENT_NOT_READY: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_EVENT_CONTENT: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_LOCATION: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_DATE_TIME: HttpStatus.UNPROCESSABLE_ENTITY,
  INACTIVE_ACTIVITY_TYPE: HttpStatus.UNPROCESSABLE_ENTITY,
  HOST_NOT_ELIGIBLE: HttpStatus.FORBIDDEN,
  EVENT_LIMIT_REACHED: HttpStatus.CONFLICT,
  RESIDENTIAL_VENUE_FORBIDDEN: HttpStatus.UNPROCESSABLE_ENTITY,
  LOCATION_PROTECTION_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

const MESSAGE: Record<EventError['code'], string> = {
  EVENT_NOT_FOUND: 'Event not found.', EVENT_REVISION_CONFLICT: 'Event changed. Reload before saving again.',
  EVENT_NOT_READY: 'The event is not ready for this operation.', INVALID_EVENT_CONTENT: 'Event content is invalid.',
  INVALID_LOCATION: 'The selected location is unavailable.', INVALID_DATE_TIME: 'The selected date or time is invalid.',
  INACTIVE_ACTIVITY_TYPE: 'The selected activity is unavailable.', HOST_NOT_ELIGIBLE: 'You do not have permission to perform this action.',
  EVENT_LIMIT_REACHED: 'The event limit was reached.', RESIDENTIAL_VENUE_FORBIDDEN: 'This location category is not available.',
  LOCATION_PROTECTION_UNAVAILABLE: 'The event service is temporarily unavailable.',
};

@Catch(EventError)
export class EventErrorFilter implements ExceptionFilter {
  catch(error: EventError, host: ArgumentsHost): void {
    const statusCode = STATUS[error.code];
    host.switchToHttp().getResponse<Response>().status(statusCode).json({ data: error.reason ? { reason: error.reason } : {}, message: MESSAGE[error.code], statusCode });
  }
}
