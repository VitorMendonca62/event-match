import { Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { LanguageCatalogReaderPort, LanguageSummary } from '../../domain/ports/language-catalog-reader.port';
import { language } from './schema/catalog.schema';

@Injectable()
export class DrizzleLanguageCatalogReaderAdapter implements LanguageCatalogReaderPort {
  listActive(context: TransactionContext, locale: 'pt-BR'): Promise<LanguageSummary[]> {
    void locale;
    return resolveExecutor(context).select({ code: language.code, label: language.labelPtBr, active: language.active })
      .from(language).where(eq(language.active, true)).orderBy(asc(language.sortOrder), asc(language.code));
  }

  findByCodes(context: TransactionContext, codes: readonly string[]): Promise<LanguageSummary[]> {
    if (codes.length === 0) return Promise.resolve([]);
    return resolveExecutor(context).select({ code: language.code, label: language.labelPtBr, active: language.active })
      .from(language).where(inArray(language.code, [...codes])).orderBy(asc(language.sortOrder), asc(language.code));
  }
}
