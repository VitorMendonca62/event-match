import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  customType,
} from 'drizzle-orm/pg-core';

const utcNow = sql`now()`;
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const contactVerification = pgTable('contact_verification', {
  id: uuid('id').primaryKey(),
  purpose: text('purpose').notNull(),
  channel: text('channel').notNull(),
  contactHash: bytea('contact_hash').notNull(),
  contactCiphertext: bytea('contact_ciphertext').notNull(),
  keyVersion: smallint('key_version').notNull().default(1),
  otpDigest: bytea('otp_digest').notNull(),
  linkTokenDigest: bytea('link_token_digest'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  failedAttempts: smallint('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  resendCount: smallint('resend_count').notNull().default(0),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull(),
  deliveryIdempotencyKey: uuid('delivery_idempotency_key').notNull(),
  whatsappConsentAt: timestamp('whatsapp_consent_at', { withTimezone: true }),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(utcNow),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(utcNow),
}, (table) => [
  check('contact_verification_purpose_check', sql`${table.purpose} = 'registration'`),
  check('contact_verification_channel_check', sql`${table.channel} in ('email', 'whatsapp')`),
  check('contact_verification_status_check', sql`${table.status} in ('open', 'verified', 'consumed', 'expired')`),
  check('contact_verification_failed_attempts_check', sql`${table.failedAttempts} between 0 and 5`),
  check('contact_verification_resend_count_check', sql`${table.resendCount} between 0 and 3`),
  check('contact_verification_whatsapp_consent_check', sql`${table.channel} <> 'whatsapp' or ${table.whatsappConsentAt} is not null`),
  unique('contact_verification_delivery_key_unique').on(table.deliveryIdempotencyKey),
  uniqueIndex('contact_verification_open_contact_unique').on(table.contactHash, table.purpose).where(sql`${table.status} in ('open', 'verified')`),
  index('contact_verification_expires_at_index').on(table.expiresAt),
]);

export const verificationRateWindow = pgTable('verification_rate_window', {
  scope: text('scope').notNull(),
  subjectHash: bytea('subject_hash').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  requestCount: integer('request_count').notNull().default(0),
  resendCount: integer('resend_count').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.scope, table.subjectHash, table.windowStart] }),
  check('verification_rate_window_scope_check', sql`${table.scope} in ('contact', 'origin')`),
  check('verification_rate_window_counts_check', sql`${table.requestCount} >= 0 and ${table.resendCount} >= 0`),
]);

export const registration = pgTable('registration', {
  id: uuid('id').primaryKey(),
  verificationId: uuid('verification_id').notNull().references(() => contactVerification.id),
  channel: text('channel').notNull(),
  contactHash: bytea('contact_hash'),
  contactCiphertext: bytea('contact_ciphertext'),
  keyVersion: smallint('key_version'),
  passwordHash: text('password_hash'),
  status: text('status').notNull().default('registration_in_progress'),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
}, (table) => [
  check('registration_channel_check', sql`${table.channel} in ('email', 'whatsapp')`),
  check('registration_status_check', sql`${table.status} in ('registration_in_progress', 'converted', 'expired')`),
  check(
    'registration_retained_data_check',
    sql`(${table.status} = 'registration_in_progress') = (${table.contactHash} is not null and ${table.contactCiphertext} is not null and ${table.keyVersion} is not null and ${table.passwordHash} is not null)`,
  ),
  unique('registration_verification_unique').on(table.verificationId),
  uniqueIndex('registration_retained_contact_unique').on(table.contactHash).where(sql`${table.status} = 'registration_in_progress'`),
  index('registration_status_expires_at_index').on(table.status, table.expiresAt),
]);

export const account = pgTable('account', {
  id: uuid('id').primaryKey(),
  registrationId: uuid('registration_id').notNull().references(() => registration.id).unique(),
  status: text('status').notNull().default('account_incomplete'),
  birthDate: date('birth_date'),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
}, (table) => [
  check('account_status_check', sql`${table.status} in ('account_incomplete', 'active', 'expired')`),
  check('account_active_data_check', sql`${table.status} <> 'active' or (${table.birthDate} is not null and ${table.activatedAt} is not null)`),
  index('account_status_updated_at_index').on(table.status, table.lastUpdatedAt),
]);

export const accountContact = pgTable('account_contact', {
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  contactHash: bytea('contact_hash'),
  contactCiphertext: bytea('contact_ciphertext'),
  keyVersion: smallint('key_version').notNull().default(1),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  holdsContact: boolean('holds_contact').notNull().default(true),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.channel] }),
  check('account_contact_channel_check', sql`${table.channel} in ('email', 'whatsapp')`),
  check(
    'account_contact_holding_check',
    sql`${table.holdsContact} = (${table.contactHash} is not null and ${table.contactCiphertext} is not null)`,
  ),
  uniqueIndex('account_contact_holding_contact_unique').on(table.channel, table.contactHash).where(sql`${table.holdsContact}`),
]);

export const accountCredential = pgTable('account_credential', {
  accountId: uuid('account_id').primaryKey().references(() => account.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash'),
  algorithm: text('algorithm').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const termsDocument = pgTable('terms_document', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  version: text('version').notNull(),
  locale: text('locale').notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  contentDigest: bytea('content_digest').notNull(),
  status: text('status').notNull().default('placeholder'),
}, (table) => [
  check('terms_document_kind_check', sql`${table.kind} in ('terms', 'privacy', 'community_rules')`),
  check('terms_document_status_check', sql`${table.status} in ('placeholder', 'approved', 'retired')`),
  unique('terms_document_kind_version_locale_unique').on(table.kind, table.version, table.locale),
]);

export const termsAcceptance = pgTable('terms_acceptance', {
  id: uuid('id').primaryKey(),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'restrict' }),
  documentId: uuid('document_id').notNull().references(() => termsDocument.id, { onDelete: 'restrict' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  context: jsonb('context').notNull(),
}, (table) => [unique('terms_acceptance_account_document_unique').on(table.accountId, table.documentId)]);
