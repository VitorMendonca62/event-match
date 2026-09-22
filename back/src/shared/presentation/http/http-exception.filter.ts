import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

import { ApiResponseDto } from './api-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = this.getStatusCode(exception);
    const message = this.getMessage(statusCode);

    response.status(statusCode).json(new ApiResponseDto({}, message, statusCode));
  }

  private getStatusCode(exception: unknown): HttpStatus {
    if (exception instanceof HttpException) {
      return exception.getStatus() as HttpStatus;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(statusCode: HttpStatus): string {
    const messages: Partial<Record<HttpStatus, string>> = {
      [HttpStatus.BAD_REQUEST]: 'Invalid request.',
      [HttpStatus.UNAUTHORIZED]: 'Authentication is required.',
      [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action.',
      [HttpStatus.NOT_FOUND]: 'Resource not found.',
      [HttpStatus.CONFLICT]: 'The request conflicts with the current resource state.',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'The request could not be processed.',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests.',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable.',
    };

    return messages[statusCode] ?? 'An unexpected error occurred.';
  }
}
