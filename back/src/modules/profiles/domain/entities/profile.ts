import { ProfileError } from '../errors/profile.error';

export const USAGE_INTENTS = ['friendship', 'activity_company', 'explore_city', 'networking'] as const;
export type UsageIntent = (typeof USAGE_INTENTS)[number];
export type ProfileFieldVisibility = 'private' | 'authenticated' | 'public';
export type EditableProfileVisibility = Exclude<ProfileFieldVisibility, 'public'>;
export type ProfileInterest = Readonly<{ id: string; slug: string; label: string }>;
export type ProfilePhoto = Readonly<{ deliveryUrl: string; width: 512; height: 512 }>;
export const PRONOUN_SELECTIONS = ['ela_dela', 'ele_dele', 'elu_delu', 'other', 'prefer_not_to_say'] as const;
export type PronounSelection = (typeof PRONOUN_SELECTIONS)[number];
export type ProfileLanguage = Readonly<{ code: string; label: string; active: boolean }>;
export type ProfileActivityPreference = Readonly<{ code: string; label: string; active: boolean }>;
export const MAX_ACTIVITY_PREFERENCES = 5;

export type ProfileState = Readonly<{
  accountId: string;
  revision: number;
  displayName: string;
  region: string;
  usageIntents: readonly UsageIntent[];
  interests: readonly ProfileInterest[];
  presentation: string | null;
  photoVisibility: ProfileFieldVisibility;
  presentationVisibility: ProfileFieldVisibility;
  photo: ProfilePhoto | null;
  pronounSelection: PronounSelection | null;
  customPronouns: string | null;
  pronounsVisibility: ProfileFieldVisibility;
  profession: string | null;
  professionVisibility: ProfileFieldVisibility;
  languages: readonly ProfileLanguage[];
  languagesVisibility: ProfileFieldVisibility;
  activityPreferences: readonly ProfileActivityPreference[];
  activityPreferencesVisibility: ProfileFieldVisibility;
}>;

const CONTACT_PATTERN = /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4})/iu;
const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
  });

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export class Profile {
  private constructor(private readonly state: ProfileState) {}

  static restore(state: ProfileState): Profile {
    if (!Number.isInteger(state.revision) || state.revision < 1) throw new ProfileError('INVALID_PROFILE_CONTENT');
    return new Profile(state);
  }

  update(input: Omit<ProfileState, 'accountId' | 'revision' | 'photo'>): Profile {
    const displayName = normalizeText(input.displayName);
    const region = normalizeText(input.region);
    const presentation = input.presentation === null ? null : normalizeText(input.presentation);
    const customPronouns = input.customPronouns === null ? null : normalizeText(input.customPronouns);
    const profession = input.profession === null ? null : normalizeText(input.profession);
    const intents = [...new Set(input.usageIntents)];
    const interests = [...new Map(input.interests.map((interest) => [interest.id, interest])).values()];
    const allowedIntents = new Set<string>(USAGE_INTENTS);
    const valid =
      displayName.length >= 1 && displayName.length <= 60 &&
      region.length >= 2 && region.length <= 80 &&
      intents.length === input.usageIntents.length && intents.length >= 1 && intents.every((item) => allowedIntents.has(item)) &&
      interests.length === input.interests.length && interests.length >= 3 &&
      (!presentation || (presentation.length <= 500 && !hasControlCharacter(presentation) && !CONTACT_PATTERN.test(presentation))) &&
      ['private', 'authenticated'].includes(input.photoVisibility) &&
      ['private', 'authenticated'].includes(input.presentationVisibility);
    const identityValid =
      (input.pronounSelection === null || PRONOUN_SELECTIONS.includes(input.pronounSelection)) &&
      (input.pronounSelection === 'other'
        ? !!customPronouns && customPronouns.length <= 40 && !hasControlCharacter(customPronouns) && !CONTACT_PATTERN.test(customPronouns)
        : customPronouns === null) &&
      (input.pronounSelection !== 'prefer_not_to_say' || input.pronounsVisibility === 'private') &&
      (!profession || (profession.length <= 80 && !hasControlCharacter(profession) && !CONTACT_PATTERN.test(profession))) &&
      input.languages.length <= 5 && new Set(input.languages.map(({ code }) => code)).size === input.languages.length &&
      ['private', 'authenticated'].includes(input.pronounsVisibility) &&
      ['private', 'authenticated'].includes(input.professionVisibility) &&
      ['private', 'authenticated'].includes(input.languagesVisibility);
    const preferencesValid =
      input.activityPreferences.length <= MAX_ACTIVITY_PREFERENCES &&
      new Set(input.activityPreferences.map(({ code }) => code)).size === input.activityPreferences.length &&
      ['private', 'authenticated'].includes(input.activityPreferencesVisibility);
    if (!valid || !identityValid || !preferencesValid) throw new ProfileError('INVALID_PROFILE_CONTENT');
    return new Profile({
      ...this.state,
      displayName,
      region,
      usageIntents: intents,
      interests,
      presentation: presentation || null,
      photoVisibility: input.photoVisibility,
      presentationVisibility: input.presentationVisibility,
      pronounSelection: input.pronounSelection,
      customPronouns,
      pronounsVisibility: input.pronounsVisibility,
      profession: profession || null,
      professionVisibility: input.professionVisibility,
      languages: [...input.languages],
      languagesVisibility: input.languagesVisibility,
      activityPreferences: [...input.activityPreferences],
      activityPreferencesVisibility: input.activityPreferencesVisibility,
      revision: this.state.revision + 1,
    });
  }

  snapshot(): ProfileState { return this.state; }
}
