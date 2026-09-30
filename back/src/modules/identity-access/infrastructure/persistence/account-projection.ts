import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { bytea } from './bytea';

/**
 * Read-only projection of the account tables owned by registration (ADR-033). Only the columns
 * authentication needs are declared, and this file lives outside the drizzle-kit schema glob, so
 * it never generates DDL: the physical definitions stay with their owner and neither context
 * imports the other's infrastructure.
 */
export const accountProjection = pgTable('account', {
  id: uuid('id').primaryKey(),
  status: text('status').notNull(),
});

export const accountContactProjection = pgTable('account_contact', {
  accountId: uuid('account_id').notNull(),
  channel: text('channel').notNull(),
  contactHash: bytea('contact_hash'),
  holdsContact: boolean('holds_contact').notNull(),
});

export const accountCredentialProjection = pgTable('account_credential', {
  accountId: uuid('account_id').primaryKey(),
  passwordHash: text('password_hash'),
});
