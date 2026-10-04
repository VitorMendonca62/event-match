import type { ProfileState } from '../entities/profile';

export type ProfilePreview = Readonly<{
  displayName: string;
  region: string;
  usageIntents: ProfileState['usageIntents'];
  interests: ProfileState['interests'];
  presentation?: string;
  photo?: NonNullable<ProfileState['photo']>;
}>;

export class ProfilePreviewProjector {
  project(profile: ProfileState): ProfilePreview {
    return {
      displayName: profile.displayName,
      region: profile.region,
      usageIntents: profile.usageIntents,
      interests: profile.interests,
      ...(profile.presentationVisibility === 'authenticated' && profile.presentation ? { presentation: profile.presentation } : {}),
      ...(profile.photoVisibility === 'authenticated' && profile.photo ? { photo: profile.photo } : {}),
    };
  }
}
