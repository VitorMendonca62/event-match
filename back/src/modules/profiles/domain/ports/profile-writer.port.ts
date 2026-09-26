import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';

export const PROFILE_WRITER_PORT = Symbol('PROFILE_WRITER_PORT');

export interface RequiredProfileData {
  readonly displayName: string;
  readonly region: string;
}

/** Writes profile data owned by the profiles context inside the caller's unit of work. */
export interface ProfileWriterPort {
  upsertRequired(context: TransactionContext, accountId: string, data: RequiredProfileData): Promise<void>;
  replaceUsageIntents(context: TransactionContext, accountId: string, intents: readonly string[]): Promise<void>;
  replaceInterests(context: TransactionContext, accountId: string, interestIds: readonly string[]): Promise<void>;
  /** Nulls required data and removes selections of expired accounts (ADR-017). */
  erasePersonalData(context: TransactionContext, accountIds: readonly string[]): Promise<void>;
}
