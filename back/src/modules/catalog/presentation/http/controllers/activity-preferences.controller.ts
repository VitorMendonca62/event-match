import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { BadRequestResponseDto, OkResponseDto } from '../../../../../shared/presentation/http/api-response.dto';
import { LocaleQueryDto } from '../../../../../shared/presentation/http/locale-query.dto';
import { ListActiveActivityPreferences } from '../../../application/use-cases/list-active-activity-preferences.use-case';
import { ActivityPreferenceListResponseDto, type ActivityPreferenceListDto } from '../dto/activity-preferences.dto';

@ApiTags('catalog')
@Controller(`${API_V1_PREFIX}/catalog/activity-preferences`)
export class ActivityPreferencesController {
  constructor(private readonly listActiveActivityPreferences: ListActiveActivityPreferences) {}

  @Get()
  @ApiOperation({ summary: 'List active activity preferences in stable catalog order' })
  @ApiOkResponse({ type: ActivityPreferenceListResponseDto })
  @ApiBadRequestResponse({ type: BadRequestResponseDto })
  @ApiServiceUnavailableResponse()
  async list(@Query() query: LocaleQueryDto): Promise<OkResponseDto<ActivityPreferenceListDto>> {
    const preferences = await this.listActiveActivityPreferences.execute(query.locale ?? 'pt-BR');
    return new OkResponseDto(
      { activityPreferences: preferences.map(({ code, label }) => ({ code, label })) },
      'Preferências de atividades disponíveis.',
    );
  }
}
