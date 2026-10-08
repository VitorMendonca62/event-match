import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { MunicipalityCatalogReaderPort } from '../../domain/ports/municipality-catalog-reader.port';
import type { UfCode } from '../../domain/value-objects/location';

export class SearchMunicipalities {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly municipalities: MunicipalityCatalogReaderPort,
  ) {}

  execute(input: Readonly<{ ufCode: UfCode; query?: string }>) {
    return this.uow.execute((context) => this.municipalities.searchActive(context, input));
  }
}
