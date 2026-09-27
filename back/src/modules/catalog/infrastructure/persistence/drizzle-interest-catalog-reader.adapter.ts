import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../shared/infrastructure/persistence/uuid';
import type {
  InterestCatalogReaderPort,
  InterestRef,
  InterestSummary,
} from '../../domain/ports/interest-catalog-reader.port';
import { interest } from './schema/catalog.schema';

@Injectable()
export class DrizzleInterestCatalogReaderAdapter implements InterestCatalogReaderPort {
  async findActiveByIds(context: TransactionContext, ids: readonly string[]): Promise<InterestRef[]> {
    // Malformed ids simply do not match, instead of aborting the transaction with a cast error.
    const candidates = ids.filter(isUuid);
    if (candidates.length === 0) return [];
    return resolveExecutor(context)
      .select({ id: interest.id })
      .from(interest)
      .where(and(eq(interest.active, true), inArray(interest.id, candidates)));
  }

  async listActive(context: TransactionContext): Promise<InterestSummary[]> {
    return resolveExecutor(context)
      .select({ id: interest.id, slug: interest.slug, label: interest.label })
      .from(interest)
      .where(eq(interest.active, true))
      .orderBy(asc(interest.position), asc(interest.slug));
  }
}
