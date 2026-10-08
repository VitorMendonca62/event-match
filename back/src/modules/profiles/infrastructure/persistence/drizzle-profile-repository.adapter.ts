import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { Profile, ProfileState, UsageIntent } from '../../domain/entities/profile';
import { toCanonicalOrder, type AvailabilitySlot } from '../../domain/value-objects/availability';
import type { PersistedProfileState, ProfileRepositoryPort } from '../../domain/ports/outbound/profile-repository.port';
import { accountInterest, profile, profileActivityPreference, profileAvailabilitySlot, profileLanguage, profilePhotoAsset, profileSocialLink, profileUsageIntent } from './schema/profiles.schema';

@Injectable()
export class DrizzleProfileRepositoryAdapter implements ProfileRepositoryPort {
  async findOwn(context: TransactionContext, accountId: string): Promise<PersistedProfileState | null> {
    const database = resolveExecutor(context);
    const [row] = await database.select().from(profile).where(eq(profile.accountId, accountId)).limit(1);
    if (!row?.displayName || !row.region) return null;
    const [intents, interests, languages, preferences, availability, photos, socialLinks] = await Promise.all([
      database.select({ value: profileUsageIntent.usageIntent }).from(profileUsageIntent).where(eq(profileUsageIntent.accountId, accountId)),
      database.select({ id: accountInterest.interestId }).from(accountInterest).where(eq(accountInterest.accountId, accountId)),
      database.select({ code: profileLanguage.languageCode })
        .from(profileLanguage)
        .where(eq(profileLanguage.accountId, accountId)).orderBy(profileLanguage.selectedAt),
      database.select({ code: profileActivityPreference.preferenceCode }).from(profileActivityPreference)
        .where(eq(profileActivityPreference.accountId, accountId)),
      database.select({ weekday: profileAvailabilitySlot.weekday, period: profileAvailabilitySlot.period })
        .from(profileAvailabilitySlot)
        .where(eq(profileAvailabilitySlot.accountId, accountId)),
      database.select({ publicId: profilePhotoAsset.publicId }).from(profilePhotoAsset)
        .where(and(eq(profilePhotoAsset.accountId, accountId), eq(profilePhotoAsset.state, 'active'))).limit(1),
      database.select({
        id: profileSocialLink.id,
        provider: profileSocialLink.provider,
        canonicalIdentifier: profileSocialLink.canonicalIdentifier,
        position: profileSocialLink.position,
        visibility: profileSocialLink.visibility,
      }).from(profileSocialLink)
        .where(eq(profileSocialLink.accountId, accountId)).orderBy(asc(profileSocialLink.position)),
    ]);
    return {
      accountId, revision: row.revision, displayName: row.displayName, region: row.region,
      usageIntents: intents.map(({ value }) => value as UsageIntent), interests: interests.map(({ id }) => ({ id, slug: '', label: '' })),
      presentation: row.presentation, photoVisibility: row.photoVisibility as ProfileState['photoVisibility'],
      presentationVisibility: row.presentationVisibility as ProfileState['presentationVisibility'],
      pronounSelection: row.pronounSelection as ProfileState['pronounSelection'], customPronouns: row.customPronouns,
      pronounsVisibility: row.pronounsVisibility as ProfileState['pronounsVisibility'], profession: row.profession,
      professionVisibility: row.professionVisibility as ProfileState['professionVisibility'],
      languageCodes: languages.map(({ code }) => code),
      languagesVisibility: row.languagesVisibility as ProfileState['languagesVisibility'],
      activityPreferenceCodes: preferences.map(({ code }) => code),
      activityPreferencesVisibility: row.activityPreferencesVisibility as ProfileState['activityPreferencesVisibility'],
      availabilitySlots: toCanonicalOrder(availability.map(({ weekday, period }) => `${weekday}_${period}` as AvailabilitySlot)),
      preferredDistance: row.preferredDistance as ProfileState['preferredDistance'],
      socialLinks: socialLinks.map((link) => ({
        id: link.id,
        provider: link.provider as ProfileState['socialLinks'][number]['provider'],
        canonicalIdentifier: link.canonicalIdentifier,
        position: link.position,
        visibility: link.visibility as ProfileState['socialLinks'][number]['visibility'],
      })),
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
      pronounSelection: value.pronounSelection, customPronouns: value.customPronouns,
      pronounsVisibility: value.pronounsVisibility, profession: value.profession,
      professionVisibility: value.professionVisibility, languagesVisibility: value.languagesVisibility,
      activityPreferencesVisibility: value.activityPreferencesVisibility,
      preferredDistance: value.preferredDistance,
      revision: value.revision, updatedAt: new Date(),
    }).where(and(eq(profile.accountId, value.accountId), eq(profile.revision, expectedRevision))).returning({ accountId: profile.accountId });
    if (changed.length === 0) return 'conflict';
    await database.delete(profileUsageIntent).where(eq(profileUsageIntent.accountId, value.accountId));
    await database.insert(profileUsageIntent).values(value.usageIntents.map((usageIntent) => ({ accountId: value.accountId, usageIntent, selectedAt: new Date() })));
    await database.delete(accountInterest).where(eq(accountInterest.accountId, value.accountId));
    await database.insert(accountInterest).values(value.interests.map(({ id }) => ({ accountId: value.accountId, interestId: id, selectedAt: new Date() })));
    await database.delete(profileLanguage).where(eq(profileLanguage.accountId, value.accountId));
    const selectedAt = Date.now();
    if (value.languages.length > 0) await database.insert(profileLanguage).values(value.languages.map(({ code }, index) => ({ accountId: value.accountId, languageCode: code, selectedAt: new Date(selectedAt + index) })));
    await database.delete(profileActivityPreference).where(eq(profileActivityPreference.accountId, value.accountId));
    if (value.activityPreferences.length > 0) await database.insert(profileActivityPreference).values(value.activityPreferences.map(({ code }) => ({ accountId: value.accountId, preferenceCode: code, selectedAt: new Date(selectedAt) })));
    await database.delete(profileAvailabilitySlot).where(eq(profileAvailabilitySlot.accountId, value.accountId));
    if (value.availabilitySlots.length > 0) {
      const selectedAtDate = new Date(selectedAt);
      await database.insert(profileAvailabilitySlot).values(value.availabilitySlots.map((slot) => {
        const separator = slot.indexOf('_');
        return { accountId: value.accountId, weekday: slot.slice(0, separator), period: slot.slice(separator + 1), selectedAt: selectedAtDate };
      }));
    }
    await database.delete(profileSocialLink).where(eq(profileSocialLink.accountId, value.accountId));
    if (value.socialLinks.length > 0) {
      const now = new Date();
      await database.insert(profileSocialLink).values(value.socialLinks.map((link) => ({
        id: link.id,
        accountId: value.accountId,
        provider: link.provider,
        canonicalIdentifier: link.canonicalIdentifier,
        position: link.position,
        visibility: link.visibility,
        createdAt: now,
        updatedAt: now,
      })));
    }
    return 'updated';
  }
}
