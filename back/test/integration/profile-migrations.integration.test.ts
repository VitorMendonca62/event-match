import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createEphemeralDatabase, MIGRATIONS_CONFIG, type EphemeralDatabase } from '../support/ephemeral-database';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

function migrationsThrough0006(): string {
  const folder = mkdtempSync(join(tmpdir(), 'eventmatch-migrations-'));
  cpSync(MIGRATIONS_CONFIG.migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((entry) => entry.tag <= '0006_authenticated_session');
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

describe('migration 0007 over existing 0006 profile data', () => {
  let database: EphemeralDatabase;
  let folder: string;

  beforeAll(async () => {
    folder = migrationsThrough0006();
    database = await createEphemeralDatabase(adminUrl, { initialMigrationsFolder: folder });

    await database.pool.query(`
      insert into contact_verification (
        id, purpose, channel, contact_hash, contact_ciphertext, otp_digest,
        expires_at, last_sent_at, delivery_idempotency_key, status
      ) values (
        '10000000-0000-7000-8000-000000000007', 'registration', 'email', '\\x01', '\\x02', '\\x03',
        now(), now(), '11000000-0000-7000-8000-000000000007', 'consumed'
      );
      insert into registration (
        id, verification_id, channel, status, last_updated_at, expires_at
      ) values (
        '20000000-0000-7000-8000-000000000007', '10000000-0000-7000-8000-000000000007',
        'email', 'converted', now(), now()
      );
      insert into account (
        id, registration_id, status, birth_date, last_updated_at, activated_at
      ) values (
        '30000000-0000-7000-8000-000000000007', '20000000-0000-7000-8000-000000000007',
        'active', '1990-05-10', now(), now()
      );
      insert into profile (account_id, display_name, region)
      values ('30000000-0000-7000-8000-000000000007', 'Perfil legado', 'Recife');
      insert into profile_usage_intent (account_id, usage_intent, selected_at)
      values ('30000000-0000-7000-8000-000000000007', 'friendship', now());
      insert into account_interest (account_id, interest_id, selected_at) values
        ('30000000-0000-7000-8000-000000000007', '00000000-0000-7000-8000-000000000001', now()),
        ('30000000-0000-7000-8000-000000000007', '00000000-0000-7000-8000-000000000002', now()),
        ('30000000-0000-7000-8000-000000000007', '00000000-0000-7000-8000-000000000003', now());
    `);

    await database.migrate();
  });

  afterAll(async () => {
    await database?.drop();
    rmSync(folder, { recursive: true, force: true });
  });

  test('preserves legacy profile data and applies private defaults', async () => {
    const { rows } = await database.pool.query(`
      select display_name, region, presentation, photo_visibility, presentation_visibility, revision
      from profile where account_id = '30000000-0000-7000-8000-000000000007'
    `);

    expect(rows).toEqual([{
      display_name: 'Perfil legado',
      region: 'Recife',
      presentation: null,
      photo_visibility: 'private',
      presentation_visibility: 'private',
      revision: 1,
    }]);

    const relations = await database.pool.query(`
      select
        (select count(*)::int from profile_usage_intent where account_id = '30000000-0000-7000-8000-000000000007') as intents,
        (select count(*)::int from account_interest where account_id = '30000000-0000-7000-8000-000000000007') as interests
    `);
    expect(relations.rows).toEqual([{ intents: 1, interests: 3 }]);
  });

  test('creates media tables and enforces the new profile constraints', async () => {
    const tables = await database.pool.query(`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('profile_photo_asset', 'profile_media_attempt')
      order by table_name
    `);
    expect(tables.rows).toEqual([
      { table_name: 'profile_media_attempt' },
      { table_name: 'profile_photo_asset' },
    ]);

    await expect(database.pool.query(`
      update profile set revision = 0
      where account_id = '30000000-0000-7000-8000-000000000007'
    `)).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`
      update profile set photo_visibility = 'unknown'
      where account_id = '30000000-0000-7000-8000-000000000007'
    `)).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`
      update profile set presentation = ''
      where account_id = '30000000-0000-7000-8000-000000000007'
    `)).rejects.toMatchObject({ code: '23514' });
  });
});
