import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { InterestCatalogReaderPort, InterestRef } from '../../domain/ports/interest-catalog-reader.port';

@Injectable()
export class DrizzleInterestCatalogReaderAdapter implements InterestCatalogReaderPort {
  async findActiveByIds(context: TransactionContext, ids: string[]): Promise<InterestRef[]> {
    if (!ids.length) return [];
    const result = await resolveExecutor(context).execute(sql`select id from interest where active=true and id = any(${ids}::uuid[])`);
    return result.rows.map((row) => ({ id: row.id as string }));
  }
}
