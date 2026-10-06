import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { UNIT_OF_WORK_PORT } from '../../shared/application/ports/unit-of-work.port';
import { useCaseProvider } from '../../shared/infrastructure/nest/use-case.provider';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { ListActiveInterests } from './application/use-cases/list-active-interests.use-case';
import { INTEREST_CATALOG_READER_PORT } from './domain/ports/interest-catalog-reader.port';
import { DrizzleInterestCatalogReaderAdapter } from './infrastructure/persistence/drizzle-interest-catalog-reader.adapter';
import { InterestsController } from './presentation/http/controllers/interests.controller';
import { LANGUAGE_CATALOG_READER_PORT } from './domain/ports/language-catalog-reader.port';
import { DrizzleLanguageCatalogReaderAdapter } from './infrastructure/persistence/drizzle-language-catalog-reader.adapter';
import { ListActiveLanguages } from './application/use-cases/list-active-languages.use-case';
import { LanguagesController } from './presentation/http/controllers/languages.controller';
import { ACTIVITY_PREFERENCE_CATALOG_READER_PORT } from './domain/ports/activity-preference-catalog-reader.port';
import { DrizzleActivityPreferenceCatalogReaderAdapter } from './infrastructure/persistence/drizzle-activity-preference-catalog-reader.adapter';
import { ListActiveActivityPreferences } from './application/use-cases/list-active-activity-preferences.use-case';
import { ActivityPreferencesController } from './presentation/http/controllers/activity-preferences.controller';
import { NoStoreMiddleware } from '../../shared/presentation/http/no-store.middleware';

@Module({
  imports: [PersistenceModule],
  controllers: [InterestsController, LanguagesController, ActivityPreferencesController],
  providers: [
    { provide: INTEREST_CATALOG_READER_PORT, useClass: DrizzleInterestCatalogReaderAdapter },
    useCaseProvider(ListActiveInterests, [UNIT_OF_WORK_PORT, INTEREST_CATALOG_READER_PORT]),
    { provide: LANGUAGE_CATALOG_READER_PORT, useClass: DrizzleLanguageCatalogReaderAdapter },
    useCaseProvider(ListActiveLanguages, [UNIT_OF_WORK_PORT, LANGUAGE_CATALOG_READER_PORT]),
    { provide: ACTIVITY_PREFERENCE_CATALOG_READER_PORT, useClass: DrizzleActivityPreferenceCatalogReaderAdapter },
    useCaseProvider(ListActiveActivityPreferences, [UNIT_OF_WORK_PORT, ACTIVITY_PREFERENCE_CATALOG_READER_PORT]),
  ],
  exports: [INTEREST_CATALOG_READER_PORT, LANGUAGE_CATALOG_READER_PORT, ACTIVITY_PREFERENCE_CATALOG_READER_PORT],
})
export class CatalogModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(NoStoreMiddleware).forRoutes(InterestsController, LanguagesController, ActivityPreferencesController);
  }
}
