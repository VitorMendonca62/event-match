import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { Profile, ProfileState, UsageIntent } from '../../domain/entities/profile';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/profile-repository.port';
import { accountInterest, profile, profilePhotoAsset, profileUsageIntent } from './schema/profiles.schema';

@Injectable()
export class DrizzleProfileRepositoryAdapter implements ProfileRepositoryPort {
  async findOwn(context: TransactionContext, accountId: string): Promise<ProfileState | null> {
    const database = resolveExecutor(context);
    const [row] = await database.select().from(profile).where(eq(profile.accountId, accountId)).limit(1);
    if (!row?.displayName || !row.region) return null;
    const [intents, interests, photos] = await Promise.all([
      database.select({ value: profileUsageIntent.usageIntent }).from(profileUsageIntent).where(eq(profileUsageIntent.accountId, accountId)),
      database.select({ id: accountInterest.interestId }).from(accountInterest).where(eq(accountInterest.accountId, accountId)),
      database.select({ publicId: profilePhotoAsset.publicId }).from(profilePhotoAsset)
        .where(and(eq(profilePhotoAsset.accountId, accountId), eq(profilePhotoAsset.state, 'active'))).limit(1),
    ]);
    return {
      accountId, revision: row.revision, displayName: row.displayName, region: row.region,
      usageIntents: intents.map(({ value }) => value as UsageIntent), interests: interests.map(({ id }) => ({ id, slug: '', label: '' })),
      presentation: row.presentation, photoVisibility: row.photoVisibility as ProfileState['photoVisibility'],
      presentationVisibility: row.presentationVisibility as ProfileState['presentationVisibility'],
      // Delivery URLs are attached by the media use case/adapter; persistence never invents one.
      photo: photos.length > 0 ? { deliveryUrl: '', width: 512, height: 512 } : null,
    };
  }

  async updateIfRevision(context: TransactionContext, aggregate: Profile, expectedRevision: number): Promise<'updated' | 'conflict'> {
    const database = resolveExecutor(context);
    const value = aggregate.snapshot();
    const changed = await database.update(profile).set({
      displayName: value.displayName, region: value.region, presentation: value.presentation,
      photoVisibility: value.photoVisibility, presentationVisibility: value.presentationVisibility,
      revision: value.revision, updatedAt: new Date(),
    }).where(and(eq(profile.accountId, value.accountId), eq(profile.revision, expectedRevision))).returning({ accountId: profile.accountId });
    if (changed.length === 0) return 'conflict';
    await database.delete(profileUsageIntent).where(eq(profileUsageIntent.accountId, value.accountId));
    await database.insert(profileUsageIntent).values(value.usageIntents.map((usageIntent) => ({ accountId: value.accountId, usageIntent, selectedAt: new Date() })));
    await database.delete(accountInterest).where(eq(accountInterest.accountId, value.accountId));
    await database.insert(accountInterest).values(value.interests.map(({ id }) => ({ accountId: value.accountId, interestId: id, selectedAt: new Date() })));
    return 'updated';
  }
}
