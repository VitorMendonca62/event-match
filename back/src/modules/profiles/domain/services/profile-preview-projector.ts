import type { ProfileState } from '../entities/profile';
import { toSocialProfileUrl } from '../value-objects/social-link';

export type ProfilePreview = Readonly<{
  displayName: string;
  location: Readonly<{ ufCode: string; municipalityCode: string; municipalityName: string }>;
  usageIntents: ProfileState['usageIntents'];
  interests: ProfileState['interests'];
  presentation?: string;
  photo?: NonNullable<ProfileState['photo']>;
  pronouns?: string;
  profession?: string;
  languages?: ReadonlyArray<{ code: string; label: string }>;
  activityPreferences?: ReadonlyArray<{ code: string; label: string }>;
  socialLinks?: ReadonlyArray<{ provider: ProfileState['socialLinks'][number]['provider']; identifier: string; url: string }>;
}>;

export type PronounLabels = Readonly<Record<Exclude<ProfileState['pronounSelection'], null | 'other' | 'prefer_not_to_say'>, string>>;

export class ProfilePreviewProjector {
  project(profile: ProfileState, pronounLabels: PronounLabels): ProfilePreview {
    return {
      displayName: profile.displayName,
      location: profile.location,
      usageIntents: profile.usageIntents,
      interests: profile.interests,
      ...(profile.presentationVisibility === 'authenticated' && profile.presentation ? { presentation: profile.presentation } : {}),
      ...(profile.photoVisibility === 'authenticated' && profile.photo ? { photo: profile.photo } : {}),
      ...(profile.pronounsVisibility === 'authenticated' && profile.pronounSelection && profile.pronounSelection !== 'prefer_not_to_say'
        ? { pronouns: profile.pronounSelection === 'other' ? profile.customPronouns! : pronounLabels[profile.pronounSelection] }
        : {}),
      ...(profile.professionVisibility === 'authenticated' && profile.profession ? { profession: profile.profession } : {}),
      ...(profile.languagesVisibility === 'authenticated' && profile.languages.length > 0
        ? { languages: profile.languages.map(({ code, label }) => ({ code, label })) }
        : {}),
      ...(profile.activityPreferencesVisibility === 'authenticated' && profile.activityPreferences.length > 0
        ? { activityPreferences: profile.activityPreferences.map(({ code, label }) => ({ code, label })) }
        : {}),
      ...(profile.socialLinks.some(({ visibility }) => visibility === 'authenticated')
        ? {
            socialLinks: profile.socialLinks
              .filter(({ visibility }) => visibility === 'authenticated')
              .map((link) => ({ provider: link.provider, identifier: link.canonicalIdentifier, url: toSocialProfileUrl(link) })),
          }
        : {}),
    };
  }
}
