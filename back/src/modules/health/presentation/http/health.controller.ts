import { Controller, Get, Inject } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { GetHealthPort } from '../../domain/ports/inbound/get-health.port';
import { GET_HEALTH_PORT } from '../../domain/ports/inbound/get-health.token';
import { HealthResponseDto } from './dto/health-response.dto';
import { InternalServerErrorResponseDto } from '../../../../shared/presentation/http/api-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(GET_HEALTH_PORT)
    private readonly healthService: GetHealthPort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check API process availability' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiInternalServerErrorResponse({ type: InternalServerErrorResponseDto })
  getHealth(): HealthResponseDto {
    const result = this.healthService.execute();

    return new HealthResponseDto(result, 'API disponível');
  }
}
