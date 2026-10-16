import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';

export class EventActivityTypeDto {
  @ApiProperty({ example: 'caminhada' }) readonly code!: string;
  @ApiProperty({ example: 'Caminhada' }) readonly label!: string;
}

export class EventActivityTypeListDto {
  @ApiProperty({ type: [EventActivityTypeDto] }) readonly eventActivityTypes!: EventActivityTypeDto[];
}

export const EventActivityTypeListResponseDto = apiEnvelope(EventActivityTypeListDto, 'EventActivityTypeListResponseDto', HttpStatus.OK);
