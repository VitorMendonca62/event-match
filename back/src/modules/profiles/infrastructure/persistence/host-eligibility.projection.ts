import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Read-only projections of registration-owned tables; this file is outside the schema glob. */
export const accountContactProjection = pgTable('account_contact', {
  accountId: uuid('account_id').notNull(),
  channel: text('channel').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  holdsContact: boolean('holds_contact').notNull(),
});

export const accountProjection = pgTable('account', {
  id: uuid('id').primaryKey(),
  status: text('status').notNull(),
});

export const termsAcceptanceProjection = pgTable('terms_acceptance', {
  accountId: uuid('account_id').notNull(),
  documentId: uuid('document_id').notNull(),
});

export const termsDocumentProjection = pgTable('terms_document', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
});
