import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { ActivityPreferenceCatalogReaderPort } from '../../domain/ports/activity-preference-catalog-reader.port';

export class ListActiveActivityPreferences {
  constructor(private readonly uow: UnitOfWorkPort, private readonly preferences: ActivityPreferenceCatalogReaderPort) {}

  execute(locale: 'pt-BR') {
    return this.uow.execute((context) => this.preferences.listActive(context, locale));
  }
}
