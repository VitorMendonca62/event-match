import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';

export class ActivityPreferenceDto {
  @ApiProperty({ example: 'small_group', pattern: '^[a-z][a-z0-9_]{1,39}$' }) readonly code!: string;
  @ApiProperty({ example: 'Grupo pequeno' }) readonly label!: string;
}
export class ActivityPreferenceListDto {
  @ApiProperty({ type: [ActivityPreferenceDto] }) readonly activityPreferences!: ActivityPreferenceDto[];
}
export const ActivityPreferenceListResponseDto = apiEnvelope(ActivityPreferenceListDto, 'ActivityPreferenceListResponseDto', HttpStatus.OK);
