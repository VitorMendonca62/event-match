import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { unique } from 'drizzle-orm/pg-core';

export const interest = pgTable('interest', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull(),
  label: text('label').notNull(),
  position: integer('position').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
}, (table) => [unique('interest_slug_unique').on(table.slug)]);
