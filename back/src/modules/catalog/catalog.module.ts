import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { INTEREST_CATALOG_READER_PORT } from './domain/ports/interest-catalog-reader.port';
import { DrizzleInterestCatalogReaderAdapter } from './infrastructure/persistence/drizzle-interest-catalog-reader.adapter';
@Module({ imports: [PersistenceModule], providers: [DrizzleInterestCatalogReaderAdapter, { provide: INTEREST_CATALOG_READER_PORT, useExisting: DrizzleInterestCatalogReaderAdapter }], exports: [INTEREST_CATALOG_READER_PORT] })
export class CatalogModule {}
