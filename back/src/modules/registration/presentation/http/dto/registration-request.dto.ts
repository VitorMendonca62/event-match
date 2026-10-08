import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

import { USAGE_INTENTS } from '../../../domain/value-objects/profile-fields';
import { FEDERATIVE_UNIT_CODES } from '../../../../catalog/domain/value-objects/location';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Cross-field check that stays in presentation: the confirmation never reaches the domain. */
function MatchesProperty(property: string, options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'matchesProperty',
      target: target.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          value === (args.object as Record<string, unknown>)[args.constraints[0] as string],
      },
    });
}

export class EligibilityRequestDto {
  @ApiProperty({ example: '1990-05-10', description: 'Calendar date (UTC). Never persisted.' })
  @IsString()
  @Matches(ISO_DATE)
  readonly birthDate!: string;
}

/** ADR-025: only e-mail is published; `whatsapp` fails validation before any effect. */
export const PUBLISHED_CHANNELS = ['email'] as const;

export class ContactVerificationRequestDto {
  @ApiProperty({ enum: PUBLISHED_CHANNELS, example: 'email' })
  @IsIn(PUBLISHED_CHANNELS)
  readonly channel!: (typeof PUBLISHED_CHANNELS)[number];

  @ApiProperty({ example: 'pessoa@example.test', maxLength: 254 })
  @IsString()
  @MaxLength(254)
  @IsEmail({ allow_display_name: false, allow_ip_domain: false })
  readonly contact!: string;
}

export class EmailDeliveryTestRequestDto {
  @ApiProperty({ example: 'pessoa@example.test', maxLength: 254 })
  @IsString()
  @MaxLength(254)
  @IsEmail({ allow_display_name: false, allow_ip_domain: false })
  readonly contact!: string;
}

export class ConfirmContactRequestDto {
  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  readonly otp!: string;
}

export class ConfirmLinkRequestDto {
  @ApiProperty({ example: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', description: 'Single-use e-mail link token.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  readonly token!: string;
}

export class PasswordRequestDto {
  @ApiProperty({ minLength: 8, maxLength: 256, example: 'uma frase longa e rara' })
  @IsString()
  @MaxLength(256)
  readonly password!: string;

  @ApiProperty({ minLength: 8, maxLength: 256, example: 'uma frase longa e rara' })
  @IsString()
  @MaxLength(256)
  @MatchesProperty('password')
  readonly passwordConfirmation!: string;
}

export class RequiredDataRequestDto {
  @ApiProperty({ maxLength: 60, example: 'Ana' })
  @IsString()
  @MaxLength(60)
  readonly displayName!: string;

  @ApiProperty({ enum: FEDERATIVE_UNIT_CODES, example: 'PE' })
  @IsIn(FEDERATIVE_UNIT_CODES)
  readonly ufCode!: string;

  @ApiProperty({ example: '2611606', pattern: '^\\d{7}$' })
  @IsString()
  @Matches(/^\d{7}$/u)
  readonly municipalityCode!: string;

  @ApiProperty({ enum: USAGE_INTENTS, isArray: true, example: ['friendship'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(USAGE_INTENTS.length)
  @ArrayUnique()
  @IsIn(USAGE_INTENTS, { each: true })
  readonly usageIntents!: string[];
}

export class CompleteRegistrationRequestDto {
  @ApiProperty({ example: '1990-05-10', description: 'Revalidated at activation (ADR-019).' })
  @IsString()
  @Matches(ISO_DATE)
  readonly birthDate!: string;

  @ApiProperty({ type: [String], format: 'uuid', maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  readonly documentIds!: string[];

  @ApiProperty({ type: [String], format: 'uuid', maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  readonly interestIds!: string[];
}
