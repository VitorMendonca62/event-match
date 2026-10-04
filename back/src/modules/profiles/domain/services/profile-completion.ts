import type { ProfileState } from '../entities/profile';

export type MissingProfileItem = 'display_name' | 'region' | 'usage_intents' | 'interests' | 'photo' | 'presentation';
export type ProfileCompletionResult = Readonly<{ complete: boolean; completedCount: number; totalCount: 6; missing: readonly MissingProfileItem[] }>;

export class ProfileCompletion {
  calculate(profile: ProfileState, hasActivePhoto = profile.photo !== null): ProfileCompletionResult {
    const missing: MissingProfileItem[] = [];
    if (!profile.displayName.trim()) missing.push('display_name');
    if (profile.region.trim().length < 2) missing.push('region');
    if (profile.usageIntents.length < 1) missing.push('usage_intents');
    if (profile.interests.length < 3) missing.push('interests');
    if (!hasActivePhoto) missing.push('photo');
    if (!profile.presentation?.trim()) missing.push('presentation');
    return { complete: missing.length === 0, completedCount: 6 - missing.length, totalCount: 6, missing };
  }
}
