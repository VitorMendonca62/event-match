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
  foreignKey,
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
  uniqueIndex('contact_verification_link_token_digest_unique').on(table.linkTokenDigest).where(sql`${table.linkTokenDigest} is not null`),
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
    // Explicit branches: terminal rows must hold none of the retained data (ADR-017/018).
    sql`(${table.status} = 'registration_in_progress' and ${table.contactHash} is not null and ${table.contactCiphertext} is not null and ${table.keyVersion} is not null and ${table.passwordHash} is not null) or (${table.status} <> 'registration_in_progress' and ${table.contactHash} is null and ${table.contactCiphertext} is null and ${table.keyVersion} is null and ${table.passwordHash} is null)`,
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
  // ADR-036: every canonical state is recognized; registration still produces only the first three.
  check(
    'account_status_check',
    sql`${table.status} in ('account_incomplete', 'active', 'expired', 'age_verification', 'recovery_restricted', 'deactivation_pending', 'deactivated', 'deletion_pending', 'deleted', 'suspended')`,
  ),
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
    sql`(${table.holdsContact} and ${table.contactHash} is not null and ${table.contactCiphertext} is not null) or (not ${table.holdsContact} and ${table.contactHash} is null and ${table.contactCiphertext} is null)`,
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
  content: text('content'),
  status: text('status').notNull().default('placeholder'),
}, (table) => [
  check('terms_document_kind_check', sql`${table.kind} in ('terms', 'privacy', 'community_rules')`),
  check('terms_document_approved_content_check', sql`${table.status} <> 'approved' or ${table.content} is not null`),
  check(
    'terms_document_content_digest_check',
    sql`${table.content} is null or sha256(convert_to(${table.content}, 'UTF8')) = ${table.contentDigest}`,
  ),
  check('terms_document_status_check', sql`${table.status} in ('placeholder', 'approved', 'retired')`),
  unique('terms_document_kind_version_locale_unique').on(table.kind, table.version, table.locale),
  // Current version per kind (ADR-028). The immutability trigger lives only in migration 0005.
  index('terms_document_current_idx')
    .on(table.locale, table.kind, table.effectiveAt.desc().nullsFirst())
    .where(sql`${table.status} = 'approved'`),
]);

export const termsAcceptance = pgTable('terms_acceptance', {
  id: uuid('id').primaryKey(),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'restrict' }),
  documentId: uuid('document_id').notNull().references(() => termsDocument.id, { onDelete: 'restrict' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  context: jsonb('context').notNull(),
}, (table) => [unique('terms_acceptance_account_document_unique').on(table.accountId, table.documentId)]);

/** Continuation of the HTTP journey (ADR-021): digests only, never birth date, contact or secrets. */
export const registrationFlowSession = pgTable('registration_flow_session', {
  id: uuid('id').primaryKey(),
  tokenDigest: bytea('token_digest'),
  previousTokenDigest: bytea('previous_token_digest'),
  previousValidUntil: timestamp('previous_valid_until', { withTimezone: true }),
  stage: text('stage').notNull(),
  verificationId: uuid('verification_id'),
  registrationId: uuid('registration_id').references(() => registration.id),
  accountId: uuid('account_id').references(() => account.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(utcNow),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  // Explicit names: generated ones would exceed PostgreSQL's 63-byte identifier limit.
  foreignKey({
    name: 'registration_flow_session_verification_fk',
    columns: [table.verificationId],
    foreignColumns: [contactVerification.id],
  }),
  check(
    'registration_flow_session_stage_check',
    sql`${table.stage} in ('age_eligible', 'verification_pending', 'contact_verified', 'registration_in_progress', 'account_incomplete', 'completed')`,
  ),
  check(
    'registration_flow_session_binding_check',
    // Each stage carries exactly the bindings earned so far; a neutral request keeps no challenge.
    sql`(${table.stage} = 'age_eligible' and ${table.verificationId} is null and ${table.registrationId} is null and ${table.accountId} is null) or (${table.stage} = 'verification_pending' and ${table.registrationId} is null and ${table.accountId} is null) or (${table.stage} = 'contact_verified' and ${table.verificationId} is not null and ${table.registrationId} is null and ${table.accountId} is null) or (${table.stage} = 'registration_in_progress' and ${table.verificationId} is not null and ${table.registrationId} is not null and ${table.accountId} is null) or (${table.stage} in ('account_incomplete', 'completed') and ${table.verificationId} is not null and ${table.registrationId} is not null and ${table.accountId} is not null)`,
  ),
  check(
    'registration_flow_session_previous_token_check',
    sql`(${table.previousTokenDigest} is null) = (${table.previousValidUntil} is null)`,
  ),
  check(
    'registration_flow_session_completed_check',
    sql`${table.stage} <> 'completed' or (${table.tokenDigest} is null and ${table.previousTokenDigest} is null and ${table.revokedAt} is not null)`,
  ),
  unique('registration_flow_session_token_digest_unique').on(table.tokenDigest),
  index('registration_flow_session_previous_token_digest_index').on(table.previousTokenDigest),
  index('registration_flow_session_verification_id_index').on(table.verificationId),
  index('registration_flow_session_stage_expires_at_index').on(table.stage, table.expiresAt),
]);

/** Idempotent HTTP commands (ADR-021): key/payload HMACs and a secret-free outcome only. */
export const registrationIdempotency = pgTable('registration_idempotency', {
  id: uuid('id').primaryKey(),
  flowSessionId: uuid('flow_session_id').notNull(),
  operation: text('operation').notNull(),
  keyHash: bytea('key_hash').notNull(),
  requestHash: bytea('request_hash').notNull(),
  responseBody: jsonb('response_body'),
  rotates: boolean('rotates').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(utcNow),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(utcNow),
}, (table) => [
  foreignKey({
    name: 'registration_idempotency_flow_session_fk',
    columns: [table.flowSessionId],
    foreignColumns: [registrationFlowSession.id],
  }),
  check(
    'registration_idempotency_operation_check',
    sql`${table.operation} in ('contact_request', 'contact_resend', 'contact_confirm', 'password', 'required_data', 'complete')`,
  ),
  check(
    'registration_idempotency_outcome_check',
    sql`(${table.completedAt} is null) = (${table.responseBody} is null)`,
  ),
  unique('registration_idempotency_key_unique').on(table.flowSessionId, table.operation, table.keyHash),
  index('registration_idempotency_expires_at_index').on(table.expiresAt),
]);
