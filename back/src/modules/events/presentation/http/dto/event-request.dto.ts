import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { FEDERATIVE_UNIT_CODES } from '../../../../catalog/domain/value-objects/location';
import { EVENT_ADMISSION_MODES, EVENT_VENUE_TYPES } from '../../../domain/value-objects/event-location';

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u;

export class ExactLocationDto {
  @ApiProperty({ example: -8.0476, minimum: -90, maximum: 90 })
  @IsLatitude()
  readonly latitude!: number;

  @ApiProperty({ example: -34.877, minimum: -180, maximum: 180 })
  @IsLongitude()
  readonly longitude!: number;
}

export class CreateEventDraftDto {
  @ApiPropertyOptional({ example: 'caminhada', pattern: '^[a-z][a-z0-9_]{1,59}$' })
  @IsOptional() @IsString() @Matches(/^[a-z][a-z0-9_]{1,59}$/u)
  readonly activityTypeCode?: string;

  @ApiPropertyOptional({ example: 'Caminhada no parque', maxLength: 120 })
  @IsOptional() @IsString() @Length(1, 120) @MaxLength(120)
  readonly title?: string;

  @ApiPropertyOptional({ example: 'Um encontro informal para caminhar e conversar.', maxLength: 2_000 })
  @IsOptional() @IsString() @Length(1, 2_000) @MaxLength(2_000)
  readonly description?: string;

  @ApiPropertyOptional({ example: '2026-11-15T09:00', description: 'Local date/time without offset; the municipality supplies the IANA time zone.' })
  @IsOptional() @IsString() @Matches(LOCAL_DATE_TIME_PATTERN)
  readonly startsAtLocal?: string;

  @ApiPropertyOptional({ example: '2026-11-15T12:00', nullable: true })
  @IsOptional() @IsString() @Matches(LOCAL_DATE_TIME_PATTERN)
  readonly endsAtLocal?: string | null;

  @ApiPropertyOptional({ enum: FEDERATIVE_UNIT_CODES, example: 'PE' })
  @IsOptional() @IsString() @IsIn(FEDERATIVE_UNIT_CODES)
  readonly ufCode?: string;

  @ApiPropertyOptional({ example: '2611606', pattern: '^\\d{7}$' })
  @IsOptional() @IsString() @Matches(/^\d{7}$/u)
  readonly municipalityCode?: string;

  @ApiPropertyOptional({ enum: EVENT_VENUE_TYPES, example: 'public_place' })
  @IsOptional() @IsIn(EVENT_VENUE_TYPES)
  readonly venueType?: (typeof EVENT_VENUE_TYPES)[number];

  @ApiPropertyOptional({ example: true, description: 'The host confirms that the location is not a residence.' })
  @IsOptional() @IsBoolean()
  readonly nonResidentialHostDeclaration?: boolean;

  @ApiPropertyOptional({ type: ExactLocationDto, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => ExactLocationDto)
  readonly exactLocation?: ExactLocationDto | null;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 12 })
  @IsOptional() @IsInt() @Min(1) @Max(12)
  readonly capacity?: number;

  @ApiPropertyOptional({ enum: EVENT_ADMISSION_MODES, default: 'manual_approval' })
  @IsOptional() @IsIn(EVENT_ADMISSION_MODES)
  readonly admissionMode?: (typeof EVENT_ADMISSION_MODES)[number];
}

export class UpdateEventDraftDto extends CreateEventDraftDto {
  @ApiProperty({ example: 3, minimum: 1 })
  @IsInt() @Min(1)
  readonly revision!: number;
}

export class PublishEventDto {
  @ApiPropertyOptional({ example: 3, minimum: 1 })
  @IsOptional() @IsInt() @Min(1)
  readonly revision?: number;
}
