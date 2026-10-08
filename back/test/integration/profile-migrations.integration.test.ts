import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createEphemeralDatabase, MIGRATIONS_CONFIG, type EphemeralDatabase } from '../support/ephemeral-database';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

function migrationsThrough(tag: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'eventmatch-migrations-'));
  cpSync(MIGRATIONS_CONFIG.migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((entry) => entry.tag <= tag);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

const migrationsThrough0006 = () => migrationsThrough('0006_authenticated_session');
const migrationsThrough0012 = () => migrationsThrough('0012_profile_social_links');

async function seedLegacyProfile(database: EphemeralDatabase): Promise<void> {
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
}

function seedStatement(file: string, insert: string): string {
  const migration = readFileSync(join(MIGRATIONS_CONFIG.migrationsFolder, file), 'utf8');
  const migrationBlock = migration
    .split('--> statement-breakpoint')
    .find((candidate) => candidate.includes(insert))
    ?.trim();
  const seedStart = migrationBlock?.indexOf(insert) ?? -1;
  if (!migrationBlock || seedStart < 0)
    throw new Error(`seed statement not found in ${file}`);
  return migrationBlock.slice(seedStart);
}

const languageSeedStatement = () => seedStatement('0008_profile_optional_identity.sql', 'INSERT INTO "language"');
const activityPreferenceSeedStatement = () => seedStatement('0009_profile_activity_preferences.sql', 'INSERT INTO "activity_preference"');

describe('migrations 0007 to 0012 over existing 0006 profile data', () => {
  let database: EphemeralDatabase;
  let folder: string;
  let targetFolder: string;

  beforeAll(async () => {
    folder = migrationsThrough0006();
    targetFolder = migrationsThrough0012();
    database = await createEphemeralDatabase(adminUrl, { initialMigrationsFolder: folder, migrationsFolder: targetFolder });
    await seedLegacyProfile(database);

    await database.migrate();
  });

  afterAll(async () => {
    await database?.drop();
    rmSync(folder, { recursive: true, force: true });
    rmSync(targetFolder, { recursive: true, force: true });
  });

  test('preserves the legacy profile until the destructive SDD-023 migration is explicitly applied', async () => {
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

  test('adds private optional identity and an idempotent language catalog', async () => {
    const profile = await database.pool.query(`select pronoun_selection, custom_pronouns, pronouns_visibility, profession, profession_visibility, languages_visibility from profile where account_id = '30000000-0000-7000-8000-000000000007'`);
    expect(profile.rows).toEqual([{ pronoun_selection: null, custom_pronouns: null, pronouns_visibility: 'private', profession: null, profession_visibility: 'private', languages_visibility: 'private' }]);
    const catalog = await database.pool.query(`select code, label_pt_br from language order by sort_order`);
    expect(catalog.rows).toHaveLength(13);
    expect(catalog.rows).toContainEqual({ code: 'bzs', label_pt_br: 'Libras' });
    await expect(database.pool.query(`update profile set pronoun_selection = 'other', custom_pronouns = null where account_id = '30000000-0000-7000-8000-000000000007'`)).rejects.toMatchObject({ code: '23514' });
    await database.pool.query(`insert into profile_language (account_id, language_code, selected_at) values ('30000000-0000-7000-8000-000000000007', 'pt', now())`);
    await expect(database.pool.query(`insert into profile_language (account_id, language_code, selected_at) values ('30000000-0000-7000-8000-000000000007', 'pt', now())`)).rejects.toMatchObject({ code: '23505' });
    await expect(database.pool.query(`insert into profile_language (account_id, language_code, selected_at) values ('30000000-0000-7000-8000-000000000007', 'xx', now())`)).rejects.toMatchObject({ code: '23503' });
    await expect(database.pool.query(`insert into profile_language (account_id, language_code, selected_at) values ('30000000-0000-7000-8000-000000000099', 'pt', now())`)).rejects.toMatchObject({ code: '23503' });

    await database.pool.query(languageSeedStatement());
    await database.migrate();
    const catalogAfterRerun = await database.pool.query(`select code from language order by sort_order`);
    expect(catalogAfterRerun.rows).toHaveLength(13);

    const client = await database.pool.connect();
    try {
      await client.query('begin');
      await client.query(`delete from account where id = '30000000-0000-7000-8000-000000000007'`);
      const relationAfterAccountDeletion = await client.query(`select count(*)::int as count from profile_language where account_id = '30000000-0000-7000-8000-000000000007'`);
      expect(relationAfterAccountDeletion.rows).toEqual([{ count: 0 }]);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
  test('adds a private activity preference group and an idempotent catalog', async () => {
    const id = '30000000-0000-7000-8000-000000000007';
    const profile = await database.pool.query(`select activity_preferences_visibility from profile where account_id = $1`, [id]);
    expect(profile.rows).toEqual([{ activity_preferences_visibility: 'private' }]);
    const catalog = await database.pool.query(`select code, label_pt_br, sort_order from activity_preference order by sort_order`);
    expect(catalog.rows.map(({ code }) => code)).toEqual([
      'outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group', 'medium_group',
      'light_physical_activity', 'moderate_physical_activity', 'cultural_experience',
      'conversation_and_socializing', 'structured_activity', 'spontaneous_activity',
    ]);
    expect(catalog.rows[0]).toEqual({ code: 'outdoor', label_pt_br: 'Ao ar livre', sort_order: 10 });
    const ledger = await database.pool.query(`select count(*)::int as count from drizzle.__drizzle_migrations`);
    expect(ledger.rows).toEqual([{ count: 12 }]);

    await expect(database.pool.query(`update profile set activity_preferences_visibility = 'everyone' where account_id = $1`, [id])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`insert into activity_preference (code, label_pt_br, sort_order) values ('Bad-Code', 'Inválida', 999)`)).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`insert into activity_preference (code, label_pt_br, sort_order) values ('blank_label', '  ', 998)`)).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`insert into activity_preference (code, label_pt_br, sort_order) values ('same_order', 'Mesma ordem', 10)`)).rejects.toMatchObject({ code: '23505' });
    await database.pool.query(`insert into profile_activity_preference (account_id, preference_code, selected_at) values ($1, 'small_group', now())`, [id]);
    await expect(database.pool.query(`insert into profile_activity_preference (account_id, preference_code, selected_at) values ($1, 'small_group', now())`, [id])).rejects.toMatchObject({ code: '23505' });
    await expect(database.pool.query(`insert into profile_activity_preference (account_id, preference_code, selected_at) values ($1, 'rooftop_party', now())`, [id])).rejects.toMatchObject({ code: '23503' });
    const index = await database.pool.query(`select indexname from pg_indexes where tablename = 'profile_activity_preference' and indexname = 'profile_activity_preference_preference_index'`);
    expect(index.rows).toHaveLength(1);

    await database.pool.query(activityPreferenceSeedStatement());
    await database.migrate();
    const afterRerun = await database.pool.query(`select count(*)::int as count from activity_preference`);
    expect(afterRerun.rows).toEqual([{ count: 12 }]);

    const client = await database.pool.connect();
    try {
      await client.query('begin');
      await client.query(`delete from account where id = $1`, [id]);
      const relation = await client.query(`select count(*)::int as count from profile_activity_preference where account_id = $1`, [id]);
      expect(relation.rows).toEqual([{ count: 0 }]);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  test('adds optional availability and distance with database-enforced closed values', async () => {
    const id = '30000000-0000-7000-8000-000000000007';
    const defaults = await database.pool.query(`select preferred_distance from profile where account_id = $1`, [id]);
    expect(defaults.rows).toEqual([{ preferred_distance: null }]);
    const tables = await database.pool.query(`select table_name from information_schema.tables where table_schema = 'public' and table_name = 'profile_availability_slot'`);
    expect(tables.rows).toEqual([{ table_name: 'profile_availability_slot' }]);
    await database.pool.query(`update profile set preferred_distance = 'up_to_5km' where account_id = $1`, [id]);
    await database.pool.query(`insert into profile_availability_slot (account_id, weekday, period, selected_at) values ($1, 'fri', 'early_hours', now()), ($1, 'sat', 'evening', now())`, [id]);
    await expect(database.pool.query(`update profile set preferred_distance = 'up_to_100km' where account_id = $1`, [id])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`insert into profile_availability_slot (account_id, weekday, period, selected_at) values ($1, 'monday', 'evening', now())`, [id])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`insert into profile_availability_slot (account_id, weekday, period, selected_at) values ($1, 'fri', 'early_hours', now())`, [id])).rejects.toMatchObject({ code: '23505' });
    const index = await database.pool.query(`select indexname from pg_indexes where tablename = 'profile_availability_slot' and indexname = 'profile_availability_slot_weekday_period_index'`);
    expect(index.rows).toHaveLength(1);
    const client = await database.pool.connect();
    try {
      await client.query('begin');
      await client.query(`delete from account where id = $1`, [id]);
      const relation = await client.query(`select count(*)::int as count from profile_availability_slot where account_id = $1`, [id]);
      expect(relation.rows).toEqual([{ count: 0 }]);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  test('adds social links with canonical-value checks, unique ordering and cascade deletion', async () => {
    const id = '30000000-0000-7000-8000-000000000007';
    const tables = await database.pool.query(`select table_name from information_schema.tables where table_schema = 'public' and table_name = 'profile_social_link'`);
    expect(tables.rows).toEqual([{ table_name: 'profile_social_link' }]);

    await database.pool.query(`
      insert into profile_social_link (id, account_id, provider, canonical_identifier, position, visibility)
      values
        ('70000000-0000-7000-8000-000000000001', $1, 'instagram', 'ana.silva', 1, 'private'),
        ('70000000-0000-7000-8000-000000000002', $1, 'linkedin', 'ana-silva', 2, 'authenticated')
    `, [id]);
    const links = await database.pool.query(`select provider, canonical_identifier, position, visibility from profile_social_link where account_id = $1 order by position`, [id]);
    expect(links.rows).toEqual([
      { provider: 'instagram', canonical_identifier: 'ana.silva', position: 1, visibility: 'private' },
      { provider: 'linkedin', canonical_identifier: 'ana-silva', position: 2, visibility: 'authenticated' },
    ]);
    await expect(database.pool.query(`insert into profile_social_link (id, account_id, provider, canonical_identifier, position, visibility) values ('70000000-0000-7000-8000-000000000003', $1, 'instagram', 'other', 3, 'private')`, [id])).rejects.toMatchObject({ code: '23505' });
    await expect(database.pool.query(`insert into profile_social_link (id, account_id, provider, canonical_identifier, position, visibility) values ('70000000-0000-7000-8000-000000000003', $1, 'x', 'bad-handle', 3, 'private')`, [id])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(`insert into profile_social_link (id, account_id, provider, canonical_identifier, position, visibility) values ('70000000-0000-7000-8000-000000000003', $1, 'instagram', 'other', 2, 'private')`, [id])).rejects.toMatchObject({ code: '23505' });
    await expect(database.pool.query(`insert into profile_social_link (id, account_id, provider, canonical_identifier, position, visibility) values ('70000000-0000-7000-8000-000000000003', $1, 'x', 'other_handle', 3, 'public')`, [id])).resolves.toBeDefined();

    const client = await database.pool.connect();
    try {
      await client.query('begin');
      await client.query(`delete from account where id = $1`, [id]);
      const relation = await client.query(`select count(*)::int as count from profile_social_link where account_id = $1`, [id]);
      expect(relation.rows).toEqual([{ count: 0 }]);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});

describe('migration 0013 structured location catalog', () => {
  let database: EphemeralDatabase;
  let folder: string;

  beforeAll(async () => {
    folder = migrationsThrough0012();
    database = await createEphemeralDatabase(adminUrl, { initialMigrationsFolder: folder });
  });

  afterAll(async () => {
    await database?.drop();
    rmSync(folder, { recursive: true, force: true });
  });

  test('loads the versioned catalog on an empty profile table', async () => {
    await database.migrate();

    const units = await database.pool.query(`select count(*)::int as count from federative_unit where active`);
    const municipalities = await database.pool.query(`select count(*)::int as count from municipality where active`);
    const brasilia = await database.pool.query(`select code, uf_code, name from municipality where code = '5300108'`);
    expect(units.rows).toEqual([{ count: 27 }]);
    expect(municipalities.rows).toEqual([{ count: 5571 }]);
    expect(brasilia.rows).toEqual([{ code: '5300108', uf_code: 'DF', name: 'Brasília' }]);

    await database.pool.query(`
      insert into contact_verification (
        id, purpose, channel, contact_hash, contact_ciphertext, otp_digest,
        expires_at, last_sent_at, delivery_idempotency_key, status
      ) values (
        '10000000-0000-7000-8000-000000000099', 'registration', 'email', '\\x01', '\\x02', '\\x03',
        now(), now(), '11000000-0000-7000-8000-000000000099', 'consumed'
      );
      insert into registration (
        id, verification_id, channel, status, last_updated_at, expires_at
      ) values (
        '20000000-0000-7000-8000-000000000099', '10000000-0000-7000-8000-000000000099',
        'email', 'converted', now(), now()
      );
      insert into account (
        id, registration_id, status, birth_date, last_updated_at, activated_at
      ) values (
        '30000000-0000-7000-8000-000000000099', '20000000-0000-7000-8000-000000000099',
        'active', '1990-05-10', now(), now()
      );
    `);
    await expect(database.pool.query(`
      insert into profile (account_id, display_name, uf_code, municipality_code)
      values ('30000000-0000-7000-8000-000000000099', 'UF incompatível', 'DF', '2611606')
    `)).rejects.toMatchObject({ code: '23503' });

    await database.pool.query(`
      insert into profile (account_id, display_name, uf_code, municipality_code)
      values ('30000000-0000-7000-8000-000000000099', 'Brasília histórica', 'DF', '5300108')
    `);
    await database.pool.query(`update municipality set active = false where code = '5300108'`);
    const inactive = await database.pool.query(`select code from municipality where code = '5300108' and active = false`);
    expect(inactive.rows).toEqual([{ code: '5300108' }]);
    const historicalProfile = await database.pool.query(`select municipality_code from profile where account_id = '30000000-0000-7000-8000-000000000099'`);
    expect(historicalProfile.rows).toEqual([{ municipality_code: '5300108' }]);
  });

  test('refuses to erase legacy profile data silently', async () => {
    const legacyFolder = migrationsThrough0012();
    const legacy = await createEphemeralDatabase(adminUrl, { initialMigrationsFolder: legacyFolder });
    try {
      await seedLegacyProfile(legacy);
      await expect(legacy.migrate()).rejects.toThrow('SDD-023 requires an empty profile table');
    } finally {
      await legacy.drop();
      rmSync(legacyFolder, { recursive: true, force: true });
    }
  });
});
