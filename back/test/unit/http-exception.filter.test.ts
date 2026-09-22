import { describe, expect, test } from 'bun:test';
import { BadRequestException, HttpStatus, type ArgumentsHost } from '@nestjs/common';

import { HttpExceptionFilter } from '../../src/shared/presentation/http/http-exception.filter';

describe('HttpExceptionFilter', () => {
  test('returns a safe envelope for known HTTP exceptions', () => {
    let responseStatus: number | undefined;
    let responseBody: unknown;
    const response = {
      status: (statusCode: number) => {
        responseStatus = statusCode;

        return {
          json: (body: unknown) => {
            responseBody = body;
            return response;
          },
        };
      },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    };

    const result = new HttpExceptionFilter().catch(
      new BadRequestException('private validation detail'),
      host as unknown as ArgumentsHost,
    );

    expect(result).toBeUndefined();
    expect(responseStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(responseBody).toEqual({
      data: {},
      message: 'Invalid request.',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });
});
