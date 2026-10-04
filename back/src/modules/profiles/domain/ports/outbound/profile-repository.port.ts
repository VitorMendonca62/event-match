import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { Profile, ProfileState } from '../../entities/profile';

export const PROFILE_REPOSITORY_PORT = Symbol('PROFILE_REPOSITORY_PORT');

export interface ProfileRepositoryPort {
  findOwn(context: TransactionContext, accountId: string): Promise<ProfileState | null>;
  updateIfRevision(context: TransactionContext, profile: Profile, expectedRevision: number): Promise<'updated' | 'conflict'>;
}
