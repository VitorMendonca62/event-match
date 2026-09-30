import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';

/** Session deadlines only: no account id, status, token or personal data ever leaves the backend. */
export class SessionDeadlinesDto {
  @ApiProperty({ example: true, enum: [true] })
  readonly authenticated!: true;

  @ApiProperty({ example: '2026-09-30T00:00:00.000Z', description: 'Absolute deadline; never extended.' })
  readonly expiresAt!: string;

  @ApiProperty({ example: '2026-09-29T12:30:00.000Z', description: 'Inactivity deadline.' })
  readonly idleExpiresAt!: string;

  @ApiProperty({ example: false })
  readonly remembered!: boolean;
}

export class SessionStateDto extends SessionDeadlinesDto {
  @ApiProperty({ example: false, description: 'A remembered session is due for rotation.' })
  readonly rotationDue!: boolean;
}

export class LoggedOutDto {
  @ApiProperty({ example: true, enum: [true] })
  readonly loggedOut!: true;
}

export const LoginResponseDto = apiEnvelope(SessionDeadlinesDto, 'LoginResponseDto', HttpStatus.OK);
export const SessionResponseDto = apiEnvelope(SessionStateDto, 'SessionResponseDto', HttpStatus.OK);
export const LogoutResponseDto = apiEnvelope(LoggedOutDto, 'LogoutResponseDto', HttpStatus.OK);

