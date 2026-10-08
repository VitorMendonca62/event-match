import { HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';
import { FEDERATIVE_UNIT_CODES } from '../../../domain/value-objects/location';

export class FederativeUnitDto {
  @ApiProperty({ enum: FEDERATIVE_UNIT_CODES, example: 'PE' })
  readonly code!: string;

  @ApiProperty({ example: 'Pernambuco' })
  readonly name!: string;
}

export class FederativeUnitListDto {
  @ApiProperty({ type: [FederativeUnitDto] })
  readonly federativeUnits!: FederativeUnitDto[];
}

export class MunicipalityDto {
  @ApiProperty({ example: '2611606', pattern: '^\\d{7}$' })
  readonly code!: string;

  @ApiProperty({ example: 'Recife' })
  readonly name!: string;

  @ApiProperty({ enum: FEDERATIVE_UNIT_CODES, example: 'PE' })
  readonly ufCode!: string;
}

export class MunicipalityListDto {
  @ApiProperty({ type: [MunicipalityDto], maxItems: 20 })
  readonly municipalities!: MunicipalityDto[];
}

export class MunicipalityQueryDto {
  @ApiProperty({ enum: FEDERATIVE_UNIT_CODES, example: 'PE' })
  @IsString()
  @IsIn(FEDERATIVE_UNIT_CODES)
  readonly uf!: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 80, example: 'são' })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/^[\p{L}\p{N} .'-]+$/u)
  @Transform(({ value }) => typeof value === 'string' ? value.normalize('NFC').trim() : value)
  readonly q?: string;
}

export const FederativeUnitListResponseDto = apiEnvelope(FederativeUnitListDto, 'FederativeUnitListResponseDto', HttpStatus.OK);
export const MunicipalityListResponseDto = apiEnvelope(MunicipalityListDto, 'MunicipalityListResponseDto', HttpStatus.OK);
