import type { HttpStatus, Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/**
 * OpenAPI schema of the standard envelope `{ data, message, statusCode }` (ADR-006) around a
 * concrete data DTO. Controllers still return `ApiResponseDto` instances; this class only
 * documents the shape.
 */
export function apiEnvelope<TData>(data: Type<TData>, name: string, statusCode: HttpStatus): Type<unknown> {
  class Envelope {
    @ApiProperty({ type: data })
    readonly data!: TData;

    @ApiProperty({ example: 'Request completed successfully.' })
    readonly message!: string;

    @ApiProperty({ example: statusCode })
    readonly statusCode!: number;
  }
  Object.defineProperty(Envelope, 'name', { value: name });
  return Envelope;
}
