import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';

export class InterestDto {
  @ApiProperty({ format: 'uuid', example: '00000000-0000-7000-8000-000000000001' })
  readonly id!: string;

  @ApiProperty({ example: 'cafe-e-gastronomia' })
  readonly slug!: string;

  @ApiProperty({ example: 'Café e gastronomia' })
  readonly label!: string;
}

export class InterestListDto {
  @ApiProperty({ type: [InterestDto] })
  readonly interests!: InterestDto[];
}

export const InterestListResponseDto = apiEnvelope(InterestListDto, 'InterestListResponseDto', HttpStatus.OK);
