import { ApiProperty } from '@nestjs/swagger';

import { OkResponseDto } from '../../../../../shared/presentation/http/api-response.dto';

export class HealthDataDto {
  @ApiProperty({ enum: ['ok'] })
  readonly status!: 'ok';
}

export class HealthResponseDto extends OkResponseDto<HealthDataDto> {}
