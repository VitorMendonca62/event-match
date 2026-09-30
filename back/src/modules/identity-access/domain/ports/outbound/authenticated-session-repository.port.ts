import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import type { AuthenticatedSession } from '../../entities/authenticated-session';

export const AUTHENTICATED_SESSION_REPOSITORY_PORT = Symbol('AUTHENTICATED_SESSION_REPOSITORY_PORT');

export interface SessionMatch {
  readonly session: AuthenticatedSession;
  /** `previous` only while the post-rotation grace is open; it never starts a new rotation. */
  readonly matched: 'current' | 'previous';
}

export interface AuthenticatedSessionRepositoryPort {
  /**
   * Serializes the account's sessions, removes its expired ones and, when `maxSessions` valid
   * sessions already exist, evicts the least recently used before inserting (ADR-033).
   */
  insertWithinLimit(
    context: TransactionContext,
    session: AuthenticatedSession,
    maxSessions: number,
    now: Date,
  ): Promise<{ evicted: number }>;
  /** Locks the row whose current digest, or still-valid previous digest, matches. */
  findByDigestForUpdate(context: TransactionContext, digest: Uint8Array, now: Date): Promise<SessionMatch | null>;
  save(context: TransactionContext, session: AuthenticatedSession): Promise<void>;
  /** Revocation removes the row; reusing its token afterwards fails. */
  delete(context: TransactionContext, sessionId: string): Promise<void>;
  deleteByDigest(context: TransactionContext, digest: Uint8Array, now: Date): Promise<boolean>;
  /** Bounded opportunistic cleanup of expired rows of any account. */
  pruneExpired(context: TransactionContext, now: Date, limit: number): Promise<number>;
}
