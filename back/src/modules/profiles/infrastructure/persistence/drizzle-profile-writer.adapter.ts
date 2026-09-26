import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { ProfileWriterPort, RequiredProfileData } from '../../domain/ports/profile-writer.port';
import { accountInterest, profile, profileUsageIntent } from './schema/profiles.schema';

@Injectable()
export class DrizzleProfileWriterAdapter implements ProfileWriterPort {
  async upsertRequired(context: TransactionContext, accountId: string, data: RequiredProfileData): Promise<void> {
    const now = new Date();
    await resolveExecutor(context)
      .insert(profile)
      .values({ accountId, displayName: data.displayName, region: data.region, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: profile.accountId,
        set: { displayName: data.displayName, region: data.region, updatedAt: now },
      });
  }

  async replaceUsageIntents(
    context: TransactionContext,
    accountId: string,
    intents: readonly string[],
  ): Promise<void> {
    const database = resolveExecutor(context);
    const selectedAt = new Date();
    await database.delete(profileUsageIntent).where(eq(profileUsageIntent.accountId, accountId));
    if (intents.length === 0) return;
    await database
      .insert(profileUsageIntent)
      .values(intents.map((usageIntent) => ({ accountId, usageIntent, selectedAt })));
  }

  async replaceInterests(
    context: TransactionContext,
    accountId: string,
    interestIds: readonly string[],
  ): Promise<void> {
    const database = resolveExecutor(context);
    const selectedAt = new Date();
    await database.delete(accountInterest).where(eq(accountInterest.accountId, accountId));
    if (interestIds.length === 0) return;
    await database
      .insert(accountInterest)
      .values(interestIds.map((interestId) => ({ accountId, interestId, selectedAt })));
  }

  async erasePersonalData(context: TransactionContext, accountIds: readonly string[]): Promise<void> {
    if (accountIds.length === 0) return;
    const database = resolveExecutor(context);
    const ids = [...accountIds];
    await database
      .update(profile)
      .set({ displayName: null, region: null, updatedAt: new Date() })
      .where(inArray(profile.accountId, ids));
    await database.delete(profileUsageIntent).where(inArray(profileUsageIntent.accountId, ids));
    await database.delete(accountInterest).where(inArray(accountInterest.accountId, ids));
  }
}
