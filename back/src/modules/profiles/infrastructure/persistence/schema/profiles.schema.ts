import { sql } from 'drizzle-orm';
import { check, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { account } from '../../../../registration/infrastructure/persistence/schema/registration.schema';
import { interest } from '../../../../catalog/infrastructure/persistence/schema/catalog.schema';

export const profile = pgTable('profile', {
  accountId: uuid('account_id').primaryKey().references(() => account.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  region: text('region'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('profile_display_name_length_check', sql`char_length(${table.displayName}) between 1 and 60`),
  check('profile_region_length_check', sql`char_length(${table.region}) between 2 and 80`),
]);

export const profileUsageIntent = pgTable('profile_usage_intent', {
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  usageIntent: text('usage_intent').notNull(),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.usageIntent] }),
  check('profile_usage_intent_value_check', sql`${table.usageIntent} in ('friendship', 'activity_company', 'explore_city', 'networking')`),
]);

export const accountInterest = pgTable('account_interest', {
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  interestId: uuid('interest_id').notNull().references(() => interest.id),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.accountId, table.interestId] })]);
