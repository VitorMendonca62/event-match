import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const eventLocationSearchRateGate = pgTable('event_location_search_rate_gate', {
  key: text('key').primaryKey(),
  nextAllowedAt: timestamp('next_allowed_at', { withTimezone: true }).notNull(),
}, (table) => [check('event_location_search_rate_gate_key_check', sql`${table.key} = 'nominatim'`)]);
