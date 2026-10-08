import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { InterestCatalogReaderPort } from '../../../catalog/domain/ports/interest-catalog-reader.port';
import type { LanguageCatalogReaderPort } from '../../../catalog/domain/ports/language-catalog-reader.port';
import type { ActivityPreferenceCatalogReaderPort } from '../../../catalog/domain/ports/activity-preference-catalog-reader.port';
import { Profile, type EditableProfileVisibility, type UsageIntent } from '../../domain/entities/profile';
import type { AvailabilitySlot, PreferredDistance } from '../../domain/value-objects/availability';
import { ProfileError } from '../../domain/errors/profile.error';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/profile-repository.port';
import type { ProfileInvitationSubjectPort } from '../../domain/ports/outbound/profile-security.port';
import type { ProfileImageStorePort, ProfileMediaRepositoryPort } from '../../domain/ports/outbound/profile-media.ports';
import { ProfileCompletion } from '../../domain/services/profile-completion';
import { ProfilePreviewProjector } from '../../domain/services/profile-preview-projector';
import { normalizeSocialLinkDrafts, toSocialProfileUrl, type SocialLinkDraft } from '../../domain/value-objects/social-link';
import type { ProfileTelemetryPort } from '../../domain/ports/outbound/profile-telemetry.port';
import { observed } from '../services/profile-telemetry';
import type { ProfileMediaPolicy } from './profile-media.use-cases';
import type { MunicipalityCatalogReaderPort } from '../../../catalog/domain/ports/municipality-catalog-reader.port';
import type { UfCode } from '../../../catalog/domain/value-objects/location';

const PRONOUN_LABELS_PT_BR = { ela_dela: 'Ela/dela', ele_dele: 'Ele/dele', elu_delu: 'Elu/delu' } as const;

async function hydrateProfile(
  context: Parameters<LanguageCatalogReaderPort['findByCodes']>[0],
  profile: Awaited<ReturnType<ProfileRepositoryPort['findOwn']>> & {},
  languages: LanguageCatalogReaderPort,
  preferences: ActivityPreferenceCatalogReaderPort,
) {
  const [entries, preferenceEntries] = await Promise.all([
    languages.findByCodes(context, profile.languageCodes),
    preferences.findByCodes(context, profile.activityPreferenceCodes),
  ]);
  const byCode = new Map(entries.map((entry) => [entry.code, entry]));
  const { activityPreferenceCodes, ...rest } = profile;
  void activityPreferenceCodes;
  return {
    ...rest,
    languages: profile.languageCodes.map((code) => byCode.get(code)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    // Catalog order, never selection order: preferences are an unordered set (ADR-044).
    activityPreferences: preferenceEntries,
  };
}

function ownView(profile: ReturnType<Profile['snapshot']>, hasActivePhoto = profile.photo !== null) {
  return {
    revision: profile.revision, displayName: profile.displayName, location: profile.location,
    usageIntents: profile.usageIntents, interests: profile.interests, presentation: profile.presentation,
    photoVisibility: profile.photoVisibility, presentationVisibility: profile.presentationVisibility, photo: profile.photo,
    pronounSelection: profile.pronounSelection, customPronouns: profile.customPronouns, pronounsVisibility: profile.pronounsVisibility,
    profession: profile.profession, professionVisibility: profile.professionVisibility,
    languages: profile.languages, languagesVisibility: profile.languagesVisibility,
    activityPreferences: profile.activityPreferences, activityPreferencesVisibility: profile.activityPreferencesVisibility,
    availabilitySlots: profile.availabilitySlots, preferredDistance: profile.preferredDistance,
    socialLinks: profile.socialLinks.map((link) => ({
      id: link.id,
      provider: link.provider,
      identifier: link.canonicalIdentifier,
      position: link.position,
      visibility: link.visibility,
      url: toSocialProfileUrl(link),
    })),
    completion: new ProfileCompletion().calculate(profile, hasActivePhoto),
  };
}

export type UpdateOwnProfileInput = Readonly<{
  accountId: string; revision: number; displayName: string; ufCode: string; municipalityCode: string;
  usageIntents: readonly UsageIntent[]; interestIds: readonly string[]; presentation: string | null;
  photoVisibility: EditableProfileVisibility; presentationVisibility: EditableProfileVisibility;
  pronounSelection: import('../../domain/entities/profile').PronounSelection | null; customPronouns: string | null;
  pronounsVisibility: EditableProfileVisibility; profession: string | null; professionVisibility: EditableProfileVisibility;
  languageCodes: readonly string[]; languagesVisibility: EditableProfileVisibility;
  activityPreferenceCodes: readonly string[]; activityPreferencesVisibility: EditableProfileVisibility;
  availabilitySlots: readonly AvailabilitySlot[]; preferredDistance: PreferredDistance | null;
  socialLinks: readonly SocialLinkDraft[];
}>;

export class GetOwnProfile {
  constructor(private readonly uow: UnitOfWorkPort, private readonly profiles: ProfileRepositoryPort, private readonly subjects: ProfileInvitationSubjectPort, private readonly catalog: InterestCatalogReaderPort, private readonly languages: LanguageCatalogReaderPort, private readonly preferences: ActivityPreferenceCatalogReaderPort, private readonly media: ProfileMediaRepositoryPort, private readonly images: ProfileImageStorePort, private readonly telemetry: ProfileTelemetryPort, private readonly mediaPolicy: ProfileMediaPolicy) {}
  async execute(accountId: string) {
    return observed(this.telemetry, 'profile.read', async () => {
    const loaded = await this.uow.execute(async (context) => {
      const found = await this.profiles.findOwn(context, accountId);
      if (!found) return null;
      const [active, hydrated, photo] = await Promise.all([
        this.catalog.listActive(context),
        hydrateProfile(context, found, this.languages, this.preferences),
        this.mediaPolicy.enabled ? this.media.findActive(context, accountId) : null,
      ]);
      const selected = new Set(found.interests.map(({ id }) => id));
      return { profile: { ...hydrated, interests: active.filter(({ id }) => selected.has(id)) }, photo };
    });
    if (!loaded) throw new ProfileError('PROFILE_NOT_FOUND');
    const delivery = loaded.photo ? await this.images.createSignedDelivery(loaded.photo) : null;
    const profile = { ...loaded.profile, photo: delivery ? { deliveryUrl: delivery.url, width: 512 as const, height: 512 as const } : null };
    return { ...ownView(profile, loaded.profile.photo !== null), invitationSubject: this.subjects.digest(accountId) };
    });
  }
}

export class UpdateOwnProfile {
  constructor(private readonly uow: UnitOfWorkPort, private readonly profiles: ProfileRepositoryPort, private readonly catalog: InterestCatalogReaderPort, private readonly languages: LanguageCatalogReaderPort, private readonly preferences: ActivityPreferenceCatalogReaderPort, private readonly municipalities: MunicipalityCatalogReaderPort, private readonly media: ProfileMediaRepositoryPort, private readonly images: ProfileImageStorePort, private readonly telemetry: ProfileTelemetryPort, private readonly mediaPolicy: ProfileMediaPolicy) {}
  async execute(input: UpdateOwnProfileInput) {
    return observed(this.telemetry, 'profile.update', async () => {
    const updated = await this.uow.execute(async (context) => {
      const current = await this.profiles.findOwn(context, input.accountId);
      if (!current) throw new ProfileError('PROFILE_NOT_FOUND');
      if (current.revision !== input.revision) throw new ProfileError('PROFILE_REVISION_CONFLICT');
      const location = await this.municipalities.findByCodeAndUf(context, {
        ufCode: input.ufCode as UfCode,
        municipalityCode: input.municipalityCode,
      });
      if (!location) throw new ProfileError('INVALID_LOCATION', 'invalid_location');
      const sameLocation = current.location.ufCode === input.ufCode && current.location.municipalityCode === input.municipalityCode;
      if (!location.active && !sameLocation) throw new ProfileError('INVALID_LOCATION', 'invalid_location');
      const interests = await this.catalog.findActiveByIds(context, input.interestIds);
      if (interests.length !== new Set(input.interestIds).size) throw new ProfileError('INACTIVE_INTEREST');
      const summaries = await this.catalog.listActive(context);
      const catalogLanguages = await this.languages.findByCodes(context, [...new Set([...input.languageCodes, ...current.languageCodes])]);
      const requestedCodes = new Set(input.languageCodes);
      const foundLanguages = catalogLanguages.filter(({ code }) => requestedCodes.has(code));
      if (foundLanguages.length !== requestedCodes.size) throw new ProfileError('UNKNOWN_LANGUAGE', 'unknown_language');
      const currentCodes = new Set(current.languageCodes);
      if (foundLanguages.some(({ code, active }) => !active && !currentCodes.has(code))) throw new ProfileError('INACTIVE_LANGUAGE', 'inactive_language');
      const languagesByCode = new Map(foundLanguages.map((item) => [item.code, item]));
      const languageEntries = input.languageCodes.map((code) => languagesByCode.get(code)!);
      const selected = new Set(input.interestIds);
      const currentByCode = new Map(catalogLanguages.map((item) => [item.code, item]));
      const catalogPreferences = await this.preferences.findByCodes(context, [...new Set([...input.activityPreferenceCodes, ...current.activityPreferenceCodes])]);
      const requestedPreferences = new Set(input.activityPreferenceCodes);
      if (requestedPreferences.size !== input.activityPreferenceCodes.length) throw new ProfileError('INVALID_PROFILE_CONTENT');
      const foundPreferences = catalogPreferences.filter(({ code }) => requestedPreferences.has(code));
      if (foundPreferences.length !== requestedPreferences.size) throw new ProfileError('UNKNOWN_ACTIVITY_PREFERENCE', 'unknown_activity_preference');
      const currentPreferences = new Set(current.activityPreferenceCodes);
      if (foundPreferences.some(({ code, active }) => !active && !currentPreferences.has(code))) throw new ProfileError('INACTIVE_ACTIVITY_PREFERENCE', 'inactive_activity_preference');
      const currentSocialLinkIds = new Set(current.socialLinks.map((link) => link.id));
      if (input.socialLinks.some((link) => link.id !== undefined && !currentSocialLinkIds.has(link.id))) throw new ProfileError('INVALID_PROFILE_CONTENT');
      const socialLinks = normalizeSocialLinkDrafts(input.socialLinks, () => crypto.randomUUID());
      const { activityPreferenceCodes: currentPreferenceCodes, ...currentRest } = current;
      const hydratedCurrent = {
        ...currentRest,
        languages: current.languageCodes.map((code) => currentByCode.get(code)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
        activityPreferences: catalogPreferences.filter(({ code }) => currentPreferenceCodes.includes(code)),
      };
      const next = Profile.restore(hydratedCurrent).update({
        displayName: input.displayName,
        location: { ufCode: location.ufCode, municipalityCode: location.municipalityCode, municipalityName: location.municipalityName },
        usageIntents: input.usageIntents,
        interests: summaries.filter((item) => selected.has(item.id)), presentation: input.presentation,
        photoVisibility: input.photoVisibility, presentationVisibility: input.presentationVisibility,
        pronounSelection: input.pronounSelection, customPronouns: input.customPronouns,
        pronounsVisibility: input.pronounsVisibility, profession: input.profession,
        professionVisibility: input.professionVisibility, languages: languageEntries,
        languagesVisibility: input.languagesVisibility,
        // findByCodes returns catalog order, so the payload order is ignored.
        activityPreferences: foundPreferences, activityPreferencesVisibility: input.activityPreferencesVisibility,
        availabilitySlots: input.availabilitySlots, preferredDistance: input.preferredDistance,
        socialLinks,
      });
      if (await this.profiles.updateIfRevision(context, next, input.revision) === 'conflict') throw new ProfileError('PROFILE_REVISION_CONFLICT');
      return { profile: next.snapshot(), photo: this.mediaPolicy.enabled ? await this.media.findActive(context, input.accountId) : null };
    });
    const delivery = updated.photo ? await this.images.createSignedDelivery(updated.photo) : null;
    return ownView(
      { ...updated.profile, photo: delivery ? { deliveryUrl: delivery.url, width: 512 as const, height: 512 as const } : null },
      updated.profile.photo !== null,
    );
    });
  }
}

export class PreviewOwnProfile {
  constructor(private readonly uow: UnitOfWorkPort, private readonly profiles: ProfileRepositoryPort, private readonly catalog: InterestCatalogReaderPort, private readonly languages: LanguageCatalogReaderPort, private readonly preferences: ActivityPreferenceCatalogReaderPort, private readonly media: ProfileMediaRepositoryPort, private readonly images: ProfileImageStorePort, private readonly telemetry: ProfileTelemetryPort, private readonly mediaPolicy: ProfileMediaPolicy) {}
  async execute(accountId: string) {
    return observed(this.telemetry, 'profile.preview', async () => {
    const loaded = await this.uow.execute(async (context) => {
      const found = await this.profiles.findOwn(context, accountId);
      if (!found) return null;
      const [active, hydrated, photo] = await Promise.all([
        this.catalog.listActive(context),
        hydrateProfile(context, found, this.languages, this.preferences),
        this.mediaPolicy.enabled ? this.media.findActive(context, accountId) : null,
      ]);
      const selected = new Set(found.interests.map(({ id }) => id));
      return { profile: { ...hydrated, interests: active.filter(({ id }) => selected.has(id)) }, photo };
    });
    if (!loaded) throw new ProfileError('PROFILE_NOT_FOUND');
    const delivery = loaded.photo ? await this.images.createSignedDelivery(loaded.photo) : null;
    const profile = { ...loaded.profile, photo: delivery ? { deliveryUrl: delivery.url, width: 512 as const, height: 512 as const } : null };
    return new ProfilePreviewProjector().project(profile, PRONOUN_LABELS_PT_BR);
    });
  }
}
