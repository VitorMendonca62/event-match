import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ACCOUNT_CAPABILITIES, type AccountCapability } from '../../../domain/value-objects/account-access';

/**
 * Login body (SDD-013 §4.3). The password is only length-bounded: the creation policy is not
 * reapplied at login. No validation message ever echoes the input.
 */
export class LoginRequestDto {
  @ApiProperty({ example: 'pessoa@example.test', maxLength: 320 })
  @IsString()
  @MaxLength(320)
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ example: 'uma senha longa e rara', minLength: 1, maxLength: 256, format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  readonly password!: string;

  @ApiProperty({ example: false, description: '“Manter conectado”: 30 days absolute, 7 days idle.' })
  @IsBoolean()
  readonly rememberMe!: boolean;
}

export class SessionQueryDto {
  @ApiPropertyOptional({ enum: ACCOUNT_CAPABILITIES, default: 'authenticated_home' })
  @IsOptional()
  @IsIn(ACCOUNT_CAPABILITIES)
  readonly capability?: AccountCapability;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    default: 'false',
    description: 'Only the BFF maintenance call rotates a due remembered session.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  readonly rotate?: 'true' | 'false';
}
