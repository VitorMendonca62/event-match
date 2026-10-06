import type { ProfileState } from '../entities/profile';

export type ProfilePreview = Readonly<{
  displayName: string;
  region: string;
  usageIntents: ProfileState['usageIntents'];
  interests: ProfileState['interests'];
  presentation?: string;
  photo?: NonNullable<ProfileState['photo']>;
  pronouns?: string;
  profession?: string;
  languages?: ReadonlyArray<{ code: string; label: string }>;
}>;

export type PronounLabels = Readonly<Record<Exclude<ProfileState['pronounSelection'], null | 'other' | 'prefer_not_to_say'>, string>>;

export class ProfilePreviewProjector {
  project(profile: ProfileState, pronounLabels: PronounLabels): ProfilePreview {
    return {
      displayName: profile.displayName,
      region: profile.region,
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
    };
  }
}
