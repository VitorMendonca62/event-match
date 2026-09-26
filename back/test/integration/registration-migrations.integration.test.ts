import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DrizzleTermsRepository } from '../../src/modules/registration/infrastructure/persistence/repositories/drizzle-terms.repository';
import { createEphemeralDatabase, MIGRATIONS_CONFIG, type EphemeralDatabase } from '../support/ephemeral-database';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

/** Copies the migrations folder keeping only the first `count` journal entries. */
function partialMigrationsFolder(count: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'eventmatch-migrations-'));
  cpSync(MIGRATIONS_CONFIG.migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

describe('migration 0002 over pre-0002 data', () => {
  let database: EphemeralDatabase;
  let folder: string;

  beforeAll(async () => {
    folder = partialMigrationsFolder(2);
    database = await createEphemeralDatabase(adminUrl, { initialMigrationsFolder: folder });
  });

  afterAll(async () => {
    await database?.drop();
    rmSync(folder, { recursive: true, force: true });
  });

  test('normalizes legacy rows so the explicit-branch checks can be added', async () => {
    const run = (text: string) => database.pool.query(text);
    await run(`insert into contact_verification (id, purpose, channel, contact_hash, contact_ciphertext, otp_digest,
                 expires_at, last_sent_at, delivery_idempotency_key, status)
               select gen_random_uuid(), 'registration', 'email', sha256(n::text::bytea), '\\x01', '\\x01',
                 now(), now(), gen_random_uuid(), 'consumed' from generate_series(1, 3) n`);
    const verifications = (await run(`select id from contact_verification order by id`)).rows as { id: string }[];
    // Legacy states the pre-0002 schema accepted: in progress without key_version, an abandoned
    // tombstone still holding the ciphertext, and a conversion recorded as 'expired'.
    await run(`insert into registration (id, verification_id, channel, contact_hash, contact_ciphertext, password_hash,
                 status, last_updated_at, expires_at, expired_at) values
               ('20000000-0000-7000-8000-000000000001', '${verifications[0]?.id}', 'email', '\\x0a', '\\x0b', 'h',
                 'registration_in_progress', now(), now() + interval '1 day', null),
               ('20000000-0000-7000-8000-000000000002', '${verifications[1]?.id}', 'email', null, '\\x0c', 'h',
                 'expired', now(), now(), now()),
               ('20000000-0000-7000-8000-000000000003', '${verifications[2]?.id}', 'email', null, null, null,
                 'expired', now(), now(), now())`);
    await run(`insert into account (id, registration_id, status, last_updated_at) values
               ('30000000-0000-7000-8000-000000000001', '20000000-0000-7000-8000-000000000003', 'expired', now())`);
    await run(`insert into account_contact (account_id, channel, contact_hash, contact_ciphertext, confirmed_at, holds_contact)
               values ('30000000-0000-7000-8000-000000000001', 'email', null, '\\x0d', now(), false)`);

    await database.migrate();

    const registrations = (
      await run(`select id, status, contact_hash is null as no_hash, contact_ciphertext is null as no_cipher,
                        key_version, password_hash is null as no_password, expired_at is null as no_expired_at
                 from registration order by id`)
    ).rows;
    expect(registrations).toEqual([
      { id: '20000000-0000-7000-8000-000000000001', status: 'registration_in_progress', no_hash: false, no_cipher: false, key_version: 1, no_password: false, no_expired_at: true },
      { id: '20000000-0000-7000-8000-000000000002', status: 'expired', no_hash: true, no_cipher: true, key_version: null, no_password: true, no_expired_at: false },
      { id: '20000000-0000-7000-8000-000000000003', status: 'converted', no_hash: true, no_cipher: true, key_version: null, no_password: true, no_expired_at: true },
    ]);
    const [contact] = (await run(`select contact_ciphertext from account_contact`)).rows;
    expect(contact).toEqual({ contact_ciphertext: null });
  });

  test('rejects terminal or released rows that keep any retained field', async () => {
    const [verification] = (await database.pool.query(`select id from contact_verification limit 1`)).rows as { id: string }[];

    await expect(
      database.pool.query(
        `insert into registration (id, verification_id, channel, contact_hash, status, last_updated_at, expires_at)
         values (gen_random_uuid(), $1, 'email', '\\x0a', 'expired', now(), now())`,
        [verification?.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      database.pool.query(
        `update account_contact set contact_ciphertext = '\\x0e' where not holds_contact`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      database.pool.query(`update account_contact set holds_contact = true, contact_hash = '\\x0f'`),
    ).rejects.toMatchObject({ code: '23514' });
  });

  test('approved documents read during activation cannot be retired until commit', async () => {
    const documentId = '10000000-0000-7000-8000-000000000009';
    await database.pool.query(
      `insert into terms_document (id, kind, version, locale, effective_at, content_digest, status)
       values ($1, 'terms', 'lock-test', 'pt-BR', now(), '\\x00', 'approved')`,
      [documentId],
    );
    const repository = new DrizzleTermsRepository();

    await drizzle({ client: database.pool }).transaction(async (transaction) => {
      await expect(repository.findApproved(transaction, [documentId])).resolves.toHaveLength(1);

      const other = await database.pool.connect();
      try {
        await other.query(`set lock_timeout = '200ms'`);
        await expect(
          other.query(`update terms_document set status = 'retired' where id = $1`, [documentId]),
        ).rejects.toMatchObject({ code: '55P03' });
        // Shared locks do not block concurrent activations reading the same document.
        await expect(
          other.query(`select id from terms_document where id = $1 for share`, [documentId]),
        ).resolves.toMatchObject({ rowCount: 1 });
      } finally {
        other.release();
      }
    });
  });
});

describe('ephemeral database setup', () => {
  test('rejects and releases its pools when CREATE DATABASE fails', async () => {
    const unreachable = new URL(adminUrl);
    unreachable.pathname = '/eventmatch_missing_admin_database';

    await expect(createEphemeralDatabase(unreachable.toString())).rejects.toMatchObject({ code: '3D000' });
  });
});
