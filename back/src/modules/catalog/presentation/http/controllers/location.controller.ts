import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { BadRequestResponseDto, OkResponseDto, ServiceUnavailableResponseDto } from '../../../../../shared/presentation/http/api-response.dto';
import { ListActiveFederativeUnits } from '../../../application/use-cases/list-active-federative-units.use-case';
import { SearchMunicipalities } from '../../../application/use-cases/search-municipalities.use-case';
import { FederativeUnitListResponseDto, type FederativeUnitListDto, MunicipalityListResponseDto, MunicipalityQueryDto, type MunicipalityListDto } from '../dto/location.dto';

@ApiTags('catalog')
@Controller(`${API_V1_PREFIX}/catalog`)
export class LocationCatalogController {
  constructor(
    private readonly listFederativeUnits: ListActiveFederativeUnits,
    private readonly searchMunicipalities: SearchMunicipalities,
  ) {}

  @Get('federative-units')
  @ApiOperation({ summary: 'List active Brazilian federative units' })
  @ApiOkResponse({ type: FederativeUnitListResponseDto })
  @ApiServiceUnavailableResponse({ type: ServiceUnavailableResponseDto })
  async listFederativeUnitsEndpoint(): Promise<OkResponseDto<FederativeUnitListDto>> {
    try {
      const units = await this.listFederativeUnits.execute();
      return new OkResponseDto({ federativeUnits: [...units] }, 'Estados disponíveis.');
    } catch {
      throw new ServiceUnavailableException();
    }
  }

  @Get('municipalities')
  @ApiOperation({ summary: 'Search active municipalities within a federative unit' })
  @ApiOkResponse({ type: MunicipalityListResponseDto })
  @ApiBadRequestResponse({ type: BadRequestResponseDto })
  @ApiServiceUnavailableResponse({ type: ServiceUnavailableResponseDto })
  async listMunicipalities(@Query() query: MunicipalityQueryDto): Promise<OkResponseDto<MunicipalityListDto>> {
    try {
      const municipalities = await this.searchMunicipalities.execute({ ufCode: query.uf as Parameters<SearchMunicipalities['execute']>[0]['ufCode'], query: query.q });
      return new OkResponseDto(
        { municipalities: municipalities.map(({ municipalityCode, municipalityName, ufCode }) => ({ code: municipalityCode, name: municipalityName, ufCode })) },
        'Municípios disponíveis.',
      );
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
