import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import type { DisplayName, Region, UsageIntent } from '../../../registration/domain/value-objects/profile-fields';
export const PROFILE_WRITER_PORT = Symbol('PROFILE_WRITER_PORT');
export interface ProfileWriterPort {
  upsertRequired(context: TransactionContext, accountId: string, input: { displayName: DisplayName; region: Region; birthDate: string }): Promise<void>;
  replaceUsageIntents(context: TransactionContext, accountId: string, intents: UsageIntent[]): Promise<void>;
  replaceInterests(context: TransactionContext, accountId: string, interestIds: string[]): Promise<void>;
}
