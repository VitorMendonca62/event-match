import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { BadRequestResponseDto, OkResponseDto } from '../../../../../shared/presentation/http/api-response.dto';
import { ListActiveInterests } from '../../../application/use-cases/list-active-interests.use-case';
import { LocaleQueryDto } from '../../../../../shared/presentation/http/locale-query.dto';
import { type InterestListDto, InterestListResponseDto } from '../dto/interests.dto';

@ApiTags('catalog')
@Controller(`${API_V1_PREFIX}/catalog/interests`)
export class InterestsController {
  constructor(private readonly listActiveInterests: ListActiveInterests) {}

  @Get()
  @ApiOperation({ summary: 'List active interests in stable catalog order' })
  @ApiOkResponse({ type: InterestListResponseDto })
  @ApiBadRequestResponse({ type: BadRequestResponseDto })
  async list(@Query() query: LocaleQueryDto): Promise<OkResponseDto<InterestListDto>> {
    void query; // Validated only: pt-BR is the single catalog locale for now.
    const interests = await this.listActiveInterests.execute();
    return new OkResponseDto({ interests }, 'Interesses disponíveis.');
  }
}
