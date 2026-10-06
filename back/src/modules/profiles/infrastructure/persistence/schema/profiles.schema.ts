import { sql } from 'drizzle-orm';
import { check, customType, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { account } from '../../../../registration/infrastructure/persistence/schema/registration.schema';
import { activityPreference, interest, language } from '../../../../catalog/infrastructure/persistence/schema/catalog.schema';
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const profile = pgTable('profile', {
  accountId: uuid('account_id').primaryKey().references(() => account.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  region: text('region'),
  presentation: text('presentation'),
  photoVisibility: text('photo_visibility').notNull().default('private'),
  presentationVisibility: text('presentation_visibility').notNull().default('private'),
  pronounSelection: text('pronoun_selection'),
  customPronouns: text('custom_pronouns'),
  pronounsVisibility: text('pronouns_visibility').notNull().default('private'),
  profession: text('profession'),
  professionVisibility: text('profession_visibility').notNull().default('private'),
  languagesVisibility: text('languages_visibility').notNull().default('private'),
  activityPreferencesVisibility: text('activity_preferences_visibility').notNull().default('private'),
  revision: integer('revision').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('profile_display_name_length_check', sql`char_length(${table.displayName}) between 1 and 60`),
  check('profile_region_length_check', sql`char_length(${table.region}) between 2 and 80`),
  check('profile_presentation_length_check', sql`${table.presentation} is null or char_length(${table.presentation}) between 1 and 500`),
  check('profile_photo_visibility_check', sql`${table.photoVisibility} in ('private', 'authenticated', 'public')`),
  check('profile_presentation_visibility_check', sql`${table.presentationVisibility} in ('private', 'authenticated', 'public')`),
  check('profile_revision_check', sql`${table.revision} > 0`),
  check('profile_pronoun_selection_check', sql`${table.pronounSelection} is null or ${table.pronounSelection} in ('ela_dela', 'ele_dele', 'elu_delu', 'other', 'prefer_not_to_say')`),
  check('profile_custom_pronouns_check', sql`(${table.pronounSelection} = 'other' and ${table.customPronouns} is not null and char_length(${table.customPronouns}) between 1 and 40) or (${table.pronounSelection} is distinct from 'other' and ${table.customPronouns} is null)`),
  check('profile_pronouns_visibility_check', sql`${table.pronounsVisibility} in ('private', 'authenticated', 'public')`),
  check('profile_profession_length_check', sql`${table.profession} is null or char_length(${table.profession}) between 1 and 80`),
  check('profile_profession_visibility_check', sql`${table.professionVisibility} in ('private', 'authenticated', 'public')`),
  check('profile_languages_visibility_check', sql`${table.languagesVisibility} in ('private', 'authenticated', 'public')`),
  check('profile_activity_preferences_visibility_check', sql`${table.activityPreferencesVisibility} in ('private', 'authenticated', 'public')`),
  check('profile_pronouns_prefer_private_check', sql`${table.pronounSelection} is distinct from 'prefer_not_to_say' or ${table.pronounsVisibility} = 'private'`),
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

export const profileLanguage = pgTable('profile_language', {
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  languageCode: text('language_code').notNull().references(() => language.code),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.languageCode] }),
  index('profile_language_language_index').on(table.languageCode),
]);

export const profileActivityPreference = pgTable('profile_activity_preference', {
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  preferenceCode: text('preference_code').notNull().references(() => activityPreference.code),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.preferenceCode] }),
  index('profile_activity_preference_preference_index').on(table.preferenceCode),
]);

export const profilePhotoAsset = pgTable('profile_photo_asset', {
  id: uuid('id').primaryKey(),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  publicId: text('public_id').notNull(),
  providerAssetId: text('provider_asset_id'),
  version: integer('version'),
  format: text('format'),
  bytes: integer('bytes'),
  width: integer('width'),
  height: integer('height'),
  state: text('state').notNull(),
  uploadExpiresAt: timestamp('upload_expires_at', { withTimezone: true }).notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  deleteAfter: timestamp('delete_after', { withTimezone: true }),
  deleteAttempts: integer('delete_attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('profile_photo_asset_provider_check', sql`${table.provider} = 'cloudinary'`),
  check('profile_photo_asset_state_check', sql`${table.state} in ('pending', 'active', 'delete_pending')`),
  uniqueIndex('profile_photo_asset_public_id_unique').on(table.publicId),
  uniqueIndex('profile_photo_asset_provider_asset_id_unique').on(table.providerAssetId),
  uniqueIndex('profile_photo_asset_one_pending_per_account').on(table.accountId).where(sql`${table.state} = 'pending'`),
  uniqueIndex('profile_photo_asset_one_active_per_account').on(table.accountId).where(sql`${table.state} = 'active'`),
  index('profile_photo_asset_cleanup_index').on(table.state, table.deleteAfter, table.uploadExpiresAt),
]);

export const profileMediaAttempt = pgTable('profile_media_attempt', {
  id: uuid('id').primaryKey(),
  scope: text('scope').notNull(),
  subjectHash: bytea('subject_hash').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
}, (table) => [
  check('profile_media_attempt_scope_check', sql`${table.scope} in ('account', 'origin')`),
  index('profile_media_attempt_subject_index').on(table.scope, table.subjectHash, table.attemptedAt),
  index('profile_media_attempt_retention_index').on(table.attemptedAt),
]);
