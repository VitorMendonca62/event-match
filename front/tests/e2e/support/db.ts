import { requireEnv } from './env';

/**
 * Direct access to the DISPOSABLE PostgreSQL created by the runner (ADR-032, AGENTS.md §10).
 * Allowed only under `tests/e2e/support/`; product code never reads the database.
 */
let connection: Bun.SQL | undefined;

function sql(): Bun.SQL {
  connection ??= new Bun.SQL(requireEnv('E2E_DATABASE_URL'));
  return connection;
}

/** The `fixture` edge provider gives every browser the same origin; the limit is ten challenges per hour. */
export async function resetOriginWindow(): Promise<void> {
  await sql()`DELETE FROM verification_rate_window WHERE scope = 'origin'`;
}

/**
 * Publishes a new approved version of `kind`, effective now, with `content` and its SHA-256 digest
 * coherent (the table checks both). Returns the new version label.
 */
export async function publishTermsVersion(kind: 'terms' | 'privacy' | 'community_rules'): Promise<string> {
  const version = `1.${Date.now()}.0`;
  await sql()`
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
  await sql()`UPDATE terms_document SET status = 'retired' WHERE status = 'approved'`;
}

/** The contact is encrypted, so the newest open challenge (the one the test just created) is used. */
export async function expireLatestVerification(): Promise<void> {
  await sql()`
    UPDATE contact_verification
       SET expires_at = now() - interval '1 second'
     WHERE id = (SELECT id FROM contact_verification WHERE status = 'open' ORDER BY created_at DESC LIMIT 1)`;
}

/** SDD-013: login buckets share the fixture origin, so each scenario starts with empty windows. */
export async function resetLoginAttempts(): Promise<void> {
  await sql()`DELETE FROM authentication_attempt`;
}

/** Moves the newest session's activity 31 minutes back, past the 30-minute idle deadline. */
export async function idleNewestSession(): Promise<void> {
  await sql()`
    UPDATE authenticated_session
       SET last_seen_at = now() - interval '31 minutes'
     WHERE id = (SELECT id FROM authenticated_session ORDER BY created_at DESC LIMIT 1)`;
}

/** Makes the newest remembered session due for its 24-hour rotation without touching deadlines. */
export async function makeNewestSessionDueForRotation(): Promise<void> {
  await sql()`
    UPDATE authenticated_session
       SET rotated_at = now() - interval '25 hours'
     WHERE id = (SELECT id FROM authenticated_session ORDER BY created_at DESC LIMIT 1)`;
}

/** The contact is protected, so the newest activated account is the one the test just created. */
export async function setNewestAccountStatus(status: 'active' | 'suspended'): Promise<void> {
  await sql()`
    UPDATE account SET status = ${status}
     WHERE id = (SELECT id FROM account WHERE activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 1)`;
}

export async function closeDatabase(): Promise<void> {
  await connection?.close();
  connection = undefined;
}
