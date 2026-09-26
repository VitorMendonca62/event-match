import { Module } from '@nestjs/common';

import { UNIT_OF_WORK_PORT } from '../../shared/application/ports/unit-of-work.port';
import { useCaseProvider } from '../../shared/infrastructure/nest/use-case.provider';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { ListActiveInterests } from './application/use-cases/list-active-interests.use-case';
import { INTEREST_CATALOG_READER_PORT } from './domain/ports/interest-catalog-reader.port';
import { DrizzleInterestCatalogReaderAdapter } from './infrastructure/persistence/drizzle-interest-catalog-reader.adapter';
import { InterestsController } from './presentation/http/controllers/interests.controller';

@Module({
  imports: [PersistenceModule],
  controllers: [InterestsController],
  providers: [
    { provide: INTEREST_CATALOG_READER_PORT, useClass: DrizzleInterestCatalogReaderAdapter },
    useCaseProvider(ListActiveInterests, [UNIT_OF_WORK_PORT, INTEREST_CATALOG_READER_PORT]),
  ],
  exports: [INTEREST_CATALOG_READER_PORT],
})
export class CatalogModule {}
