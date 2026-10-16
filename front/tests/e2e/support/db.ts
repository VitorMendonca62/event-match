import { Pool } from 'pg';

import { requireEnv } from './env';

/**
 * Direct access to the DISPOSABLE PostgreSQL created by the runner (ADR-032, AGENTS.md §10).
 * Allowed only under `tests/e2e/support/`; product code never reads the database.
 */
let connection: Pool | undefined;

function pool(): Pool {
  connection ??= new Pool({ connectionString: requireEnv('E2E_DATABASE_URL'), max: 2 });
  return connection;
}

async function sql(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<void> {
  const text = strings.reduce(
    (query, part, index) => `${query}${index === 0 ? '' : `$${index}`}${part}`,
    '',
  );
  await pool().query(text, [...values]);
}

/** The `fixture` edge provider gives every browser the same origin; the limit is ten challenges per hour. */
export async function resetOriginWindow(): Promise<void> {
  await sql`DELETE FROM verification_rate_window WHERE scope = 'origin'`;
}

/**
 * Publishes a new approved version of `kind`, effective now, with `content` and its SHA-256 digest
 * coherent (the table checks both). Returns the new version label.
 */
export async function publishTermsVersion(kind: 'terms' | 'privacy' | 'community_rules'): Promise<string> {
  const version = `1.${Date.now()}.0`;
  await sql`
    INSERT INTO terms_document (id, kind, version, locale, effective_at, content, content_digest, status)
    SELECT gen_random_uuid(), kind, ${version}, locale, now(),
           content || E'\n\nRevisão de teste E2E.\n',
           sha256(convert_to(content || E'\n\nRevisão de teste E2E.\n', 'UTF8')),
           'approved'
      FROM terms_document
     WHERE kind = ${kind} AND status = 'approved'
     ORDER BY effective_at DESC
     LIMIT 1`;
  return version;
}

/** Retires every approved document so the registration cannot be activated. Destructive project only. */
export async function retireCurrentDocuments(): Promise<void> {
  await sql`UPDATE terms_document SET status = 'retired' WHERE status = 'approved'`;
}

/** The contact is encrypted, so the newest open challenge (the one the test just created) is used. */
export async function expireLatestVerification(): Promise<void> {
  await sql`
    UPDATE contact_verification
       SET expires_at = now() - interval '1 second'
     WHERE id = (SELECT id FROM contact_verification WHERE status = 'open' ORDER BY created_at DESC LIMIT 1)`;
}

/** SDD-013: login buckets share the fixture origin, so each scenario starts with empty windows. */
export async function resetLoginAttempts(): Promise<void> {
  await sql`DELETE FROM authentication_attempt`;
}

/** Moves the newest session's activity 31 minutes back, past the 30-minute idle deadline. */
export async function idleNewestSession(): Promise<void> {
  await sql`
    UPDATE authenticated_session
       SET last_seen_at = now() - interval '31 minutes'
     WHERE id = (SELECT id FROM authenticated_session ORDER BY created_at DESC LIMIT 1)`;
}

/** Makes the newest remembered session due for its 24-hour rotation without touching deadlines. */
export async function makeNewestSessionDueForRotation(): Promise<void> {
  await sql`
    UPDATE authenticated_session
       SET rotated_at = now() - interval '25 hours'
     WHERE id = (SELECT id FROM authenticated_session ORDER BY created_at DESC LIMIT 1)`;
}

/** The contact is protected, so the newest activated account is the one the test just created. */
export async function setNewestAccountStatus(status: 'active' | 'suspended'): Promise<void> {
  await sql`
    UPDATE account SET status = ${status}
     WHERE id = (SELECT id FROM account WHERE activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 1)`;
}

/**
 * SDD-027 host fixture. This runs only against the disposable database exposed by the E2E runner;
 * it supplies the facts required by the backend's real host-eligibility check without weakening it.
 */
export async function makeNewestAccountHostEligible(): Promise<void> {
  await sql`
    WITH newest AS (
      SELECT id FROM account WHERE status = 'active' AND activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 1
    )
    INSERT INTO profile (account_id, presentation)
    SELECT newest.id, 'Gosto de conhecer a cidade em atividades de grupo.' FROM newest
    ON CONFLICT (account_id) DO UPDATE SET presentation = EXCLUDED.presentation, updated_at = now()`;
  await sql`
    WITH newest AS (
      SELECT id FROM account WHERE status = 'active' AND activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 1
    ), selected_interests AS (
      SELECT id FROM interest WHERE active ORDER BY slug LIMIT 3
    )
    INSERT INTO account_interest (account_id, interest_id, selected_at)
    SELECT newest.id, selected_interests.id, now() FROM newest CROSS JOIN selected_interests
    ON CONFLICT (account_id, interest_id) DO NOTHING`;
  await sql`
    WITH newest AS (
      SELECT id FROM account WHERE status = 'active' AND activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 1
    )
    INSERT INTO account_contact (account_id, channel, contact_hash, contact_ciphertext, confirmed_at, holds_contact)
    SELECT newest.id, 'whatsapp', decode(md5(newest.id::text || ':e2e-whatsapp'), 'hex'),
           decode(md5(newest.id::text || ':e2e-whatsapp-ciphertext'), 'hex'), now(), true
      FROM newest
    ON CONFLICT (account_id, channel) DO UPDATE
      SET contact_hash = EXCLUDED.contact_hash, contact_ciphertext = EXCLUDED.contact_ciphertext,
          confirmed_at = EXCLUDED.confirmed_at, holds_contact = true`;
  await sql`
    WITH newest AS (
      SELECT id FROM account WHERE status = 'active' AND activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 1
    )
    INSERT INTO profile_photo_asset (
      id, account_id, provider, public_id, state, upload_expires_at, activated_at
    )
    SELECT gen_random_uuid(), newest.id, 'cloudinary', 'e2e-host-' || gen_random_uuid()::text,
           'active', now() + interval '1 day', now()
      FROM newest
     WHERE NOT EXISTS (
       SELECT 1 FROM profile_photo_asset photo WHERE photo.account_id = newest.id AND photo.state = 'active'
     )`;
}

export async function closeDatabase(): Promise<void> {
  await connection?.end();
  connection = undefined;
}
