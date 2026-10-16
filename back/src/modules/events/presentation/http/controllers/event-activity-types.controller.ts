import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { BadRequestResponseDto, OkResponseDto } from '../../../../../shared/presentation/http/api-response.dto';
import { LocaleQueryDto } from '../../../../../shared/presentation/http/locale-query.dto';
import { ListActiveEventActivityTypes } from '../../../application/use-cases/list-active-event-activity-types.use-case';
import { EventActivityTypeListResponseDto, type EventActivityTypeListDto } from '../dto/event-activity-types-response.dto';

@ApiTags('catalog')
@Controller(`${API_V1_PREFIX}/catalog/event-activity-types`)
export class EventActivityTypesController {
  constructor(private readonly listActiveEventActivityTypes: ListActiveEventActivityTypes) {}

  @Get()
  @ApiOperation({ summary: 'List active event activity types in stable catalog order' })
  @ApiOkResponse({ type: EventActivityTypeListResponseDto })
  @ApiBadRequestResponse({ type: BadRequestResponseDto })
  @ApiServiceUnavailableResponse()
  async list(@Query() query: LocaleQueryDto): Promise<OkResponseDto<EventActivityTypeListDto>> {
    const activityTypes = await this.listActiveEventActivityTypes.execute(query.locale ?? 'pt-BR');
    return new OkResponseDto({ eventActivityTypes: activityTypes.map(({ code, label }) => ({ code, label })) }, 'Tipos de atividade disponíveis.');
  }
}
