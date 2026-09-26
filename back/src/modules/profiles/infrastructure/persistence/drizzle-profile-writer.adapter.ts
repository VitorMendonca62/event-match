import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { ProfileWriterPort } from '../../domain/ports/profile-writer.port';

@Injectable()
export class DrizzleProfileWriterAdapter implements ProfileWriterPort {
  async upsertRequired(context: TransactionContext, accountId: string, input: { displayName: { value: string }; region: { value: string }; birthDate: string }): Promise<void> {
    await resolveExecutor(context).execute(sql`insert into profile (account_id,display_name,region) values (${accountId},${input.displayName.value},${input.region.value}) on conflict (account_id) do update set display_name=excluded.display_name, region=excluded.region, updated_at=now()`);
  }
  async replaceUsageIntents(context: TransactionContext, accountId: string, intents: { value: string }[]): Promise<void> {
    const db = resolveExecutor(context); await db.execute(sql`delete from profile_usage_intent where account_id=${accountId}`);
    for (const intent of intents) await db.execute(sql`insert into profile_usage_intent (account_id,usage_intent,selected_at) values (${accountId},${intent.value},now())`);
  }
  async replaceInterests(context: TransactionContext, accountId: string, ids: string[]): Promise<void> {
    const db = resolveExecutor(context); await db.execute(sql`delete from account_interest where account_id=${accountId}`);
    for (const id of ids) await db.execute(sql`insert into account_interest (account_id,interest_id,selected_at) values (${accountId},${id},now())`);
  }
}
