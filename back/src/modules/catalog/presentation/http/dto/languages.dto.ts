import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';

export class LanguageDto {
  @ApiProperty({ example: 'pt' }) readonly code!: string;
  @ApiProperty({ example: 'Português' }) readonly label!: string;
}
export class LanguageListDto {
  @ApiProperty({ type: [LanguageDto] }) readonly languages!: LanguageDto[];
}
export const LanguageListResponseDto = apiEnvelope(LanguageListDto, 'LanguageListResponseDto', HttpStatus.OK);
