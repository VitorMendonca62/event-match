import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { FederativeUnitCatalogReaderPort } from '../../domain/ports/federative-unit-catalog-reader.port';

export class ListActiveFederativeUnits {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly units: FederativeUnitCatalogReaderPort,
  ) {}

  execute() {
    return this.uow.execute((context) => this.units.listActive(context));
  }
}
