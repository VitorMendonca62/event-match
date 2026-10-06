import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const interest = pgTable('interest', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull(),
  label: text('label').notNull(),
  position: integer('position').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
}, (table) => [unique('interest_slug_unique').on(table.slug)]);

export const language = pgTable('language', {
  code: text('code').primaryKey(),
  labelPtBr: text('label_pt_br').notNull(),
  sortOrder: integer('sort_order').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('language_code_check', sql`${table.code} ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`),
  check('language_label_pt_br_check', sql`char_length(trim(${table.labelPtBr})) > 0`),
  uniqueIndex('language_sort_order_unique').on(table.sortOrder),
  index('language_active_order_index').on(table.active, table.sortOrder),
]);
