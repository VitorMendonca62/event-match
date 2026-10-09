import { sql } from 'drizzle-orm';
import { boolean, char, check, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid, foreignKey } from 'drizzle-orm/pg-core';

import { FEDERATIVE_UNIT_CODES } from '../../../domain/value-objects/location';

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

export const activityPreference = pgTable('activity_preference', {
  code: text('code').primaryKey(),
  labelPtBr: text('label_pt_br').notNull(),
  sortOrder: integer('sort_order').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('activity_preference_code_check', sql`${table.code} ~ '^[a-z][a-z0-9_]{1,39}$'`),
  check('activity_preference_label_pt_br_check', sql`char_length(trim(${table.labelPtBr})) > 0`),
  uniqueIndex('activity_preference_sort_order_unique').on(table.sortOrder),
  index('activity_preference_active_order_index').on(table.active, table.sortOrder),
]);

export const federativeUnit = pgTable('federative_unit', {
  code: char('code', { length: 2 }).primaryKey(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  sourceVersion: text('source_version').notNull(),
  sourceReference: text('source_reference').notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('federative_unit_code_check', sql`${table.code} in (${sql.join(FEDERATIVE_UNIT_CODES.map((code) => sql`${code}`), sql`, `)})`),
  check('federative_unit_name_check', sql`char_length(trim(${table.name})) > 0`),
  index('federative_unit_active_name_index').on(table.active, table.name),
]);

export const municipality = pgTable('municipality', {
  code: char('code', { length: 7 }).primaryKey(),
  ufCode: char('uf_code', { length: 2 }).notNull(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  timeZone: text('time_zone').notNull().default('America/Sao_Paulo'),
  active: boolean('active').notNull().default(true),
  sourceVersion: text('source_version').notNull(),
  sourceReference: text('source_reference').notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('municipality_code_check', sql`${table.code} ~ '^[0-9]{7}$'`),
  check('municipality_uf_code_check', sql`${table.ufCode} in (${sql.join(FEDERATIVE_UNIT_CODES.map((code) => sql`${code}`), sql`, `)})`),
  check('municipality_name_check', sql`char_length(trim(${table.name})) > 0`),
  check('municipality_normalized_name_check', sql`char_length(trim(${table.normalizedName})) > 0`),
  unique('municipality_uf_code_unique').on(table.ufCode, table.code),
  index('municipality_uf_normalized_name_index').on(table.ufCode, table.normalizedName),
  index('municipality_active_uf_name_index').on(table.active, table.ufCode, table.name),
  foreignKey({ columns: [table.ufCode], foreignColumns: [federativeUnit.code], name: 'municipality_uf_code_fk' }),
]);
