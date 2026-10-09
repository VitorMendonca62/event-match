import { sql } from 'drizzle-orm';
import { boolean, check, char, customType, doublePrecision, foreignKey, index, integer, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { municipality } from '../../../../catalog/infrastructure/persistence/schema/catalog.schema';
import { account } from '../../../../registration/infrastructure/persistence/schema/registration.schema';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const eventActivityType = pgTable('event_activity_type', {
  code: text('code').primaryKey(),
  labelPtBr: text('label_pt_br').notNull(),
  sortOrder: integer('sort_order').notNull(),
  catalogVersion: text('catalog_version').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('event_activity_type_code_check', sql`${table.code} ~ '^[a-z][a-z0-9_]{1,59}$'`),
  check('event_activity_type_label_check', sql`char_length(trim(${table.labelPtBr})) > 0`),
  uniqueIndex('event_activity_type_sort_order_unique').on(table.sortOrder),
  index('event_activity_type_active_order_index').on(table.active, table.sortOrder),
]);

export const event = pgTable('event', {
  id: uuid('id').primaryKey(),
  hostAccountId: uuid('host_account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('draft'),
  activityTypeCode: text('activity_type_code'),
  title: text('title'),
  description: text('description'),
  startsAtLocal: timestamp('starts_at_local', { withTimezone: false, mode: 'string' }),
  endsAtLocal: timestamp('ends_at_local', { withTimezone: false, mode: 'string' }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  ufCode: char('uf_code', { length: 2 }),
  municipalityCode: char('municipality_code', { length: 7 }),
  municipalityName: text('municipality_name'),
  timeZone: text('time_zone'),
  venueType: text('venue_type'),
  nonResidentialHostDeclaration: boolean('non_residential_host_declaration'),
  capacity: integer('capacity'),
  admissionMode: text('admission_mode').notNull().default('manual_approval'),
  approximateLatitude: doublePrecision('approximate_latitude'),
  approximateLongitude: doublePrecision('approximate_longitude'),
  approximateRadiusMeters: integer('approximate_radius_meters'),
  official: boolean('official').notNull().default(false),
  revision: integer('revision').notNull().default(1),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('event_status_check', sql`${table.status} in ('draft', 'published_open', 'full', 'cancelled', 'completed', 'not_held')`),
  check('event_location_pair_check', sql`(${table.ufCode} is null and ${table.municipalityCode} is null and ${table.municipalityName} is null and ${table.timeZone} is null) or (${table.ufCode} is not null and ${table.municipalityCode} is not null and ${table.municipalityName} is not null and ${table.timeZone} is not null)`),
  check('event_venue_type_check', sql`${table.venueType} is null or ${table.venueType} in ('public_place', 'identifiable_establishment')`),
  check('event_non_residential_declaration_check', sql`${table.nonResidentialHostDeclaration} is null or ${table.nonResidentialHostDeclaration} = true`),
  check('event_capacity_check', sql`${table.capacity} is null or ${table.capacity} between 1 and 12`),
  check('event_admission_mode_check', sql`${table.admissionMode} in ('manual_approval', 'automatic_entry')`),
  check('event_title_length_check', sql`${table.title} is null or char_length(trim(${table.title})) between 1 and 120`),
  check('event_description_length_check', sql`${table.description} is null or char_length(trim(${table.description})) between 1 and 2_000`),
  check('event_revision_check', sql`${table.revision} > 0`),
  check('event_approximate_area_check', sql`(${table.approximateLatitude} is null and ${table.approximateLongitude} is null and ${table.approximateRadiusMeters} is null) or (${table.approximateLatitude} between -90 and 90 and ${table.approximateLongitude} between -180 and 180 and ${table.approximateRadiusMeters} between 200 and 5000)`),
  check('event_published_at_check', sql`${table.status} = 'draft' or (${table.publishedAt} is not null and ${table.approximateLatitude} is not null and ${table.approximateLongitude} is not null and ${table.approximateRadiusMeters} is not null)`),
  check('event_official_check', sql`${table.official} = false`),
  foreignKey({ columns: [table.activityTypeCode], foreignColumns: [eventActivityType.code], name: 'event_activity_type_fk' }),
  foreignKey({ columns: [table.ufCode, table.municipalityCode], foreignColumns: [municipality.ufCode, municipality.code], name: 'event_municipality_fk' }),
  index('event_host_status_starts_at_index').on(table.hostAccountId, table.status, table.startsAt),
  index('event_municipality_status_index').on(table.ufCode, table.municipalityCode, table.status),
  index('event_host_published_at_index').on(table.hostAccountId, table.publishedAt),
]);

export const eventExactLocation = pgTable('event_exact_location', {
  eventId: uuid('event_id').primaryKey().references(() => event.id, { onDelete: 'cascade' }),
  ciphertext: bytea('ciphertext').notNull(),
  iv: bytea('iv').notNull(),
  authTag: bytea('auth_tag').notNull(),
  keyVersion: smallint('key_version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('event_exact_location_iv_check', sql`octet_length(${table.iv}) = 12`),
  check('event_exact_location_auth_tag_check', sql`octet_length(${table.authTag}) = 16`),
  check('event_exact_location_key_version_check', sql`${table.keyVersion} > 0`),
]);

export const eventAudit = pgTable('event_audit', {
  id: uuid('id').primaryKey(),
  eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
  actorAccountId: uuid('actor_account_id').notNull().references(() => account.id),
  action: text('action').notNull(),
  changedFields: text('changed_fields').array().notNull().default(sql`ARRAY[]::text[]`),
  correlationId: uuid('correlation_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('event_audit_action_check', sql`${table.action} in ('draft_created', 'draft_updated', 'published')`),
  check('event_audit_changed_fields_check', sql`${table.changedFields} <@ ARRAY['activityTypeCode', 'title', 'description', 'startsAtLocal', 'endsAtLocal', 'ufCode', 'municipalityCode', 'venueType', 'nonResidentialHostDeclaration', 'exactLocation', 'capacity', 'admissionMode', 'status', 'publishedAt', 'approximateArea']::text[]`),
  index('event_audit_event_occurred_at_index').on(table.eventId, table.occurredAt),
]);
