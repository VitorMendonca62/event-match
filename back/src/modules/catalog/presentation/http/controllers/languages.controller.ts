import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { BadRequestResponseDto, OkResponseDto } from '../../../../../shared/presentation/http/api-response.dto';
import { LocaleQueryDto } from '../../../../../shared/presentation/http/locale-query.dto';
import { ListActiveLanguages } from '../../../application/use-cases/list-active-languages.use-case';
import { LanguageListResponseDto, type LanguageListDto } from '../dto/languages.dto';

@ApiTags('catalog')
@Controller(`${API_V1_PREFIX}/catalog/languages`)
export class LanguagesController {
  constructor(private readonly listActiveLanguages: ListActiveLanguages) {}

  @Get()
  @ApiOperation({ summary: 'List active languages in stable catalog order' })
  @ApiOkResponse({ type: LanguageListResponseDto })
  @ApiBadRequestResponse({ type: BadRequestResponseDto })
  @ApiServiceUnavailableResponse()
  async list(@Query() query: LocaleQueryDto): Promise<OkResponseDto<LanguageListDto>> {
    const languages = await this.listActiveLanguages.execute(query.locale ?? 'pt-BR');
    return new OkResponseDto({ languages: languages.map(({ code, label }) => ({ code, label })) }, 'Idiomas disponíveis.');
  }
}
