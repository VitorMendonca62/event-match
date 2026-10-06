import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { LanguageCatalogReaderPort } from '../../domain/ports/language-catalog-reader.port';

export class ListActiveLanguages {
  constructor(private readonly uow: UnitOfWorkPort, private readonly languages: LanguageCatalogReaderPort) {}

  execute(locale: 'pt-BR') {
    return this.uow.execute((context) => this.languages.listActive(context, locale));
  }
}
