import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type {
  InterestCatalogReaderPort,
  InterestSummary,
} from '../../domain/ports/interest-catalog-reader.port';

/** Public interest catalog for the registration journey (RF006, RN147–RN149). */
export class ListActiveInterests {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly interests: InterestCatalogReaderPort,
  ) {}

  execute(): Promise<InterestSummary[]> {
    return this.uow.execute((context) => this.interests.listActive(context));
  }
}
