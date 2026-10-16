import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { EventActivityTypeCatalogPort } from '../../domain/ports/event-activity-type-catalog.port';

export class ListActiveEventActivityTypes {
  constructor(private readonly uow: UnitOfWorkPort, private readonly activityTypes: EventActivityTypeCatalogPort) {}

  execute(locale: 'pt-BR') {
    return this.uow.execute((context) => this.activityTypes.listActive(context, locale));
  }
}
