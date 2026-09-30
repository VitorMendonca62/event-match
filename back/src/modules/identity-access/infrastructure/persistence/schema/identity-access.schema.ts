import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { accountProjection } from '../account-projection';
import { bytea } from '../bytea';

/**
 * Common sessions (ADR-033): HMAC digests only, never the token, password, contact, IP or
 * user-agent. Revocation deletes the row. Owned exclusively by identity-access.
 */
export const authenticatedSession = pgTable('authenticated_session', {
  id: uuid('id').primaryKey(),
  accountId: uuid('account_id').notNull(),
  tokenDigest: bytea('token_digest').notNull(),
  previousTokenDigest: bytea('previous_token_digest'),
  previousValidUntil: timestamp('previous_valid_until', { withTimezone: true }),
  remembered: boolean('remembered').notNull(),
  idleTimeoutSeconds: integer('idle_timeout_seconds').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }).notNull(),
  absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({
    name: 'authenticated_session_account_fk',
    columns: [table.accountId],
    foreignColumns: [accountProjection.id],
  }).onDelete('cascade'),
  check('authenticated_session_idle_timeout_check', sql`${table.idleTimeoutSeconds} > 0`),
  check('authenticated_session_deadline_check', sql`${table.absoluteExpiresAt} > ${table.createdAt}`),
  check(
    'authenticated_session_previous_token_check',
    sql`(${table.previousTokenDigest} is null) = (${table.previousValidUntil} is null)`,
  ),
  check('authenticated_session_digest_length_check', sql`octet_length(${table.tokenDigest}) = 32`),
  uniqueIndex('authenticated_session_token_digest_unique').on(table.tokenDigest),
  uniqueIndex('authenticated_session_previous_token_digest_unique')
    .on(table.previousTokenDigest)
    .where(sql`${table.previousTokenDigest} is not null`),
  index('authenticated_session_account_last_seen_index').on(table.accountId, table.lastSeenAt),
  index('authenticated_session_absolute_expires_at_index').on(table.absoluteExpiresAt),
]);

/** Login attempts of the sliding-window buckets (ADR-035): keyed digests and timestamps only. */
export const authenticationAttempt = pgTable('authentication_attempt', {
  id: uuid('id').primaryKey(),
  scope: text('scope').notNull(),
  subjectHash: bytea('subject_hash').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
}, (table) => [
  check('authentication_attempt_scope_check', sql`${table.scope} in ('contact', 'origin')`),
  index('authentication_attempt_subject_index').on(table.scope, table.subjectHash, table.attemptedAt),
  index('authentication_attempt_attempted_at_index').on(table.attemptedAt),
]);
