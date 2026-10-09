import { HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';
import { EVENT_STATUSES } from '../../../domain/entities/event';
import { EVENT_ADMISSION_MODES, EVENT_VENUE_TYPES } from '../../../domain/value-objects/event-location';

class ActivityTypeDto {
  @ApiProperty({ example: 'caminhada' }) code!: string;
  @ApiProperty({ example: 'Caminhada' }) label!: string;
}

class EventLocationDto {
  @ApiProperty({ example: 'PE' }) ufCode!: string;
  @ApiProperty({ example: '2611606' }) municipalityCode!: string;
  @ApiProperty({ example: 'Recife' }) municipalityName!: string;
}

class ExactLocationResponseDto {
  @ApiProperty({ example: -8.0476 }) latitude!: number;
  @ApiProperty({ example: -34.877 }) longitude!: number;
}

class ApproximateAreaDto {
  @ApiProperty({ example: -8.045 }) latitude!: number;
  @ApiProperty({ example: -34.875 }) longitude!: number;
  @ApiProperty({ example: 500, minimum: 200, maximum: 5_000 }) radiusMeters!: number;
}

class PublicEventLocationDto extends EventLocationDto {
  @ApiProperty({ type: ApproximateAreaDto }) approximateArea!: ApproximateAreaDto;
}

export class EventOwnerDraftResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 3 }) revision!: number;
  @ApiProperty({ enum: EVENT_STATUSES, example: 'draft' }) status!: string;
  @ApiPropertyOptional({ type: ActivityTypeDto, nullable: true }) activityType!: ActivityTypeDto | null;
  @ApiPropertyOptional({ nullable: true }) title!: string | null;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true }) startsAtLocal!: string | null;
  @ApiPropertyOptional({ nullable: true }) endsAtLocal!: string | null;
  @ApiPropertyOptional({ nullable: true }) startsAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) endsAt!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'America/Recife' }) timeZone!: string | null;
  @ApiPropertyOptional({ type: EventLocationDto, nullable: true }) location!: EventLocationDto | null;
  @ApiPropertyOptional({ enum: EVENT_VENUE_TYPES, nullable: true }) venueType!: string | null;
  @ApiPropertyOptional({ nullable: true }) nonResidentialHostDeclaration!: boolean | null;
  @ApiPropertyOptional({ type: ExactLocationResponseDto, nullable: true }) exactLocation!: ExactLocationResponseDto | null;
  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 12 }) capacity!: number | null;
  @ApiProperty({ enum: EVENT_ADMISSION_MODES }) admissionMode!: string;
  @ApiProperty({ enum: [false], example: false }) official!: false;
}

export class PublicEventPreviewResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: ActivityTypeDto }) activityType!: ActivityTypeDto;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() startsAt!: string;
  @ApiPropertyOptional({ nullable: true }) endsAt!: string | null;
  @ApiProperty() timeZone!: string;
  @ApiProperty({ type: PublicEventLocationDto }) location!: PublicEventLocationDto;
  @ApiProperty({ minimum: 1, maximum: 12 }) capacity!: number;
  @ApiProperty({ enum: EVENT_ADMISSION_MODES }) admissionMode!: string;
  @ApiProperty({ enum: ['draft', 'published_open'] }) status!: 'draft' | 'published_open';
}

export const EventOwnerDraftEnvelopeDto = apiEnvelope(EventOwnerDraftResponseDto, 'EventOwnerDraftEnvelopeDto', HttpStatus.OK);
export const CreatedEventOwnerDraftEnvelopeDto = apiEnvelope(EventOwnerDraftResponseDto, 'CreatedEventOwnerDraftEnvelopeDto', HttpStatus.CREATED);
export const PublicEventPreviewEnvelopeDto = apiEnvelope(PublicEventPreviewResponseDto, 'PublicEventPreviewEnvelopeDto', HttpStatus.OK);
