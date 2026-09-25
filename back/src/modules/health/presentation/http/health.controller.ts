import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { GetHealthPort } from '../../domain/ports/inbound/get-health.port';
import { GET_HEALTH_PORT } from '../../domain/ports/inbound/get-health.token';
import { HealthResponseDto } from './dto/health-response.dto';
import {
  InternalServerErrorResponseDto,
  ServiceUnavailableResponseDto,
} from '../../../../shared/presentation/http/api-response.dto';
import { ReadinessService } from './readiness.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(GET_HEALTH_PORT)
    private readonly healthService: GetHealthPort,
    private readonly readinessService: ReadinessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check API process availability' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiInternalServerErrorResponse({ type: InternalServerErrorResponseDto })
  getHealth(): HealthResponseDto {
    const result = this.healthService.execute();

    return new HealthResponseDto(result, 'API disponível');
  }

  @Get('readiness')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check PostgreSQL readiness' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiInternalServerErrorResponse({ type: InternalServerErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ServiceUnavailableResponseDto })
  async getReadiness(): Promise<HealthResponseDto> {
    try {
      await this.readinessService.check();

      return new HealthResponseDto(
        { status: 'ok' },
        'Banco de dados disponível',
      );
    } catch {
      throw new ServiceUnavailableException('Database unavailable.');
    }
  }
}
