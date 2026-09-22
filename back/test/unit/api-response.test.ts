import { describe, expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import {
  BadRequestResponseDto,
  ConflictResponseDto,
  CreatedResponseDto,
  ForbiddenResponseDto,
  InternalServerErrorResponseDto,
  NotFoundResponseDto,
  OkResponseDto,
  ServiceUnavailableResponseDto,
  TooManyRequestsResponseDto,
  UnauthorizedResponseDto,
  UnprocessableEntityResponseDto,
} from '../../src/shared/presentation/http/api-response.dto';

describe('HTTP response DTOs', () => {
  test('uses the standard envelope for success responses', () => {
    expect(new OkResponseDto({ status: 'ok' }, 'API available')).toEqual({
      data: { status: 'ok' },
      message: 'API available',
      statusCode: HttpStatus.OK,
    });
    expect(new CreatedResponseDto({ id: 'new' }).statusCode).toBe(HttpStatus.CREATED);
  });

  test.each([
    [new BadRequestResponseDto(), HttpStatus.BAD_REQUEST],
    [new UnauthorizedResponseDto(), HttpStatus.UNAUTHORIZED],
    [new ForbiddenResponseDto(), HttpStatus.FORBIDDEN],
    [new NotFoundResponseDto(), HttpStatus.NOT_FOUND],
    [new ConflictResponseDto(), HttpStatus.CONFLICT],
    [new UnprocessableEntityResponseDto(), HttpStatus.UNPROCESSABLE_ENTITY],
    [new TooManyRequestsResponseDto(), HttpStatus.TOO_MANY_REQUESTS],
    [new InternalServerErrorResponseDto(), HttpStatus.INTERNAL_SERVER_ERROR],
    [new ServiceUnavailableResponseDto(), HttpStatus.SERVICE_UNAVAILABLE],
  ])('uses the standard error envelope for status %i', (response, statusCode) => {
    expect(response).toEqual({
      data: {},
      message: expect.any(String),
      statusCode,
    });
  });
});
