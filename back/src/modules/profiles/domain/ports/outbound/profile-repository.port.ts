import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { Profile, ProfileState } from '../../entities/profile';

export const PROFILE_REPOSITORY_PORT = Symbol('PROFILE_REPOSITORY_PORT');

export type PersistedProfileState = Omit<ProfileState, 'languages' | 'activityPreferences'> & Readonly<{
  languageCodes: readonly string[];
  activityPreferenceCodes: readonly string[];
}>;

export interface ProfileRepositoryPort {
  findOwn(context: TransactionContext, accountId: string): Promise<PersistedProfileState | null>;
  updateIfRevision(context: TransactionContext, profile: Profile, expectedRevision: number): Promise<'updated' | 'conflict'>;
}
