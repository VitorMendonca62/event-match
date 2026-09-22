import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export type ApiResponseData = object;

export class ApiResponseDto<TData extends ApiResponseData = ApiResponseData> {
  @ApiProperty({ type: 'object', additionalProperties: true })
  readonly data: TData;

  @ApiProperty({ example: 'Request completed successfully.' })
  readonly message: string;

  @ApiProperty({ enum: HttpStatus, example: HttpStatus.OK })
  readonly statusCode: HttpStatus;

  constructor(data: TData, message: string, statusCode: HttpStatus) {
    this.data = data;
    this.message = message;
    this.statusCode = statusCode;
  }
}

export class OkResponseDto<TData extends ApiResponseData = ApiResponseData> extends ApiResponseDto<TData> {
  constructor(data: TData, message = 'Request completed successfully.') {
    super(data, message, HttpStatus.OK);
  }
}

export class CreatedResponseDto<TData extends ApiResponseData = ApiResponseData> extends ApiResponseDto<TData> {
  constructor(data: TData, message = 'Resource created successfully.') {
    super(data, message, HttpStatus.CREATED);
  }
}

export class BadRequestResponseDto extends ApiResponseDto {
  constructor(message = 'Invalid request.') {
    super({}, message, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedResponseDto extends ApiResponseDto {
  constructor(message = 'Authentication is required.') {
    super({}, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenResponseDto extends ApiResponseDto {
  constructor(message = 'You do not have permission to perform this action.') {
    super({}, message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundResponseDto extends ApiResponseDto {
  constructor(message = 'Resource not found.') {
    super({}, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictResponseDto extends ApiResponseDto {
  constructor(message = 'The request conflicts with the current resource state.') {
    super({}, message, HttpStatus.CONFLICT);
  }
}

export class UnprocessableEntityResponseDto extends ApiResponseDto {
  constructor(message = 'The request could not be processed.') {
    super({}, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class TooManyRequestsResponseDto extends ApiResponseDto {
  constructor(message = 'Too many requests.') {
    super({}, message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class InternalServerErrorResponseDto extends ApiResponseDto {
  constructor(message = 'An unexpected error occurred.') {
    super({}, message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class ServiceUnavailableResponseDto extends ApiResponseDto {
  constructor(message = 'Service is temporarily unavailable.') {
    super({}, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
