import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { drizzle } from 'drizzle-orm/node-postgres';

import { createEphemeralDatabase, type EphemeralDatabase } from '../support/ephemeral-database';
import type { TransactionContext } from '../../src/shared/application/ports/unit-of-work.port';
import { DrizzleEventActivityTypeCatalogAdapter } from '../../src/modules/events/infrastructure/persistence/drizzle-event-activity-type-catalog.adapter';
import { PostgresLocationSearchRateGateAdapter } from '../../src/modules/events/infrastructure/persistence/postgres-location-search-rate-gate.adapter';
import type { PostgresPool } from '../../src/shared/infrastructure/persistence/database.types';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

const REGISTRATION_ID = '20000000-0000-7000-8000-000000000025';
const VERIFICATION_ID = '10000000-0000-7000-8000-000000000025';
const ACCOUNT_ID = '30000000-0000-7000-8000-000000000025';

describe('events persistence (PostgreSQL integration, SDD-025)', () => {
  let database: EphemeralDatabase;

  const query = async <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
    (await database.pool.query<T>(text, values)).rows;

  beforeAll(async () => {
    database = await createEphemeralDatabase(adminUrl);
    await database.pool.query(`
      insert into contact_verification (
        id, purpose, channel, contact_hash, contact_ciphertext, otp_digest,
        expires_at, last_sent_at, delivery_idempotency_key, status
      ) values ($1::uuid, 'registration', 'email', '\\x01', '\\x02', '\\x03', now(), now(), $2::uuid, 'consumed');
    `, [VERIFICATION_ID, '11000000-0000-7000-8000-000000000025']);
    await database.pool.query(`
      insert into registration (
        id, verification_id, channel, status, last_updated_at, expires_at
      ) values ($1::uuid, $2::uuid, 'email', 'converted', now(), now());
    `, [REGISTRATION_ID, VERIFICATION_ID]);
    await database.pool.query(`
      insert into account (
        id, registration_id, status, birth_date, last_updated_at, activated_at
      ) values ($1::uuid, $2::uuid, 'active', '1990-05-10', now(), now());
    `, [ACCOUNT_ID, REGISTRATION_ID]);
    await database.pool.query(`
      insert into event (
        id, host_account_id, status, activity_type_code, title, description,
        starts_at_local, starts_at, uf_code, municipality_code, municipality_name, time_zone,
        venue_type, non_residential_host_declaration, capacity, admission_mode,
        approximate_latitude, approximate_longitude, approximate_radius_meters, published_at
      ) values (
        '40000000-0000-7000-8000-000000000026', $1::uuid, 'published_open', 'caminhada',
        'Caminhada', 'Encontro informal', '2030-01-02 09:00:00', '2030-01-02 12:00:00+00',
        'PE', '2611606', 'Recife', 'America/Recife', 'public_place', true, 8, 'manual_approval',
        -8.045, -34.875, 500, '2029-12-01 12:00:00+00'
      );
    `, [ACCOUNT_ID]);
  });

  afterAll(async () => {
    await database?.drop();
  });

  test('seeds activity types and persists municipality time zones', async () => {
    const [activityCount] = await query<{ count: string }>(`select count(*)::text as count from event_activity_type where active`);
    const zones = await query<{ code: string; time_zone: string }>(
      `select code, time_zone from municipality where code in ('1200401', '1301407', '1506807', '2611606') order by code`,
    );

    expect(activityCount?.count).toBe('19');
    expect(zones).toEqual([
      { code: '1200401', time_zone: 'America/Rio_Branco' },
      { code: '1301407', time_zone: 'America/Eirunepe' },
      { code: '1506807', time_zone: 'America/Santarem' },
      { code: '2611606', time_zone: 'America/Recife' },
    ]);
  });

  test('activity catalog adapter returns only active entries in stable order', async () => {
    await query(`update event_activity_type set active = false where code = 'caminhada'`);
    try {
      const adapter = new DrizzleEventActivityTypeCatalogAdapter();
      const context = drizzle({ client: database.pool }) as unknown as TransactionContext;
      const items = await adapter.listActive(context, 'pt-BR');
      const expected = await query<{ code: string; label_pt_br: string }>(
        `select code, label_pt_br from event_activity_type where active order by sort_order asc, code asc limit 100`,
      );

      expect(items).toEqual(expected.map(({ code, label_pt_br }) => ({ code, label: label_pt_br, active: true })));
      expect(items.some((item) => item.code === 'caminhada')).toBe(false);
    } finally {
      await query(`update event_activity_type set active = true where code = 'caminhada'`);
    }
  });

  test('Nominatim rate gate allows one request per second across independent PostgreSQL connections', async () => {
    const [connectionA, connectionB] = await Promise.all([
      database.pool.connect(),
      database.pool.connect(),
    ]);
    try {
      await connectionA.query(`update event_location_search_rate_gate set next_allowed_at = clock_timestamp() - interval '1 second' where key = 'nominatim'`);
      const [pidA] = (await connectionA.query<{ pid: number }>('select pg_backend_pid() as pid')).rows;
      const [pidB] = (await connectionB.query<{ pid: number }>('select pg_backend_pid() as pid')).rows;
      expect(pidA?.pid).not.toBe(pidB?.pid);

      const gateA = new PostgresLocationSearchRateGateAdapter({ query: connectionA.query.bind(connectionA) } as unknown as PostgresPool);
      const gateB = new PostgresLocationSearchRateGateAdapter({ query: connectionB.query.bind(connectionB) } as unknown as PostgresPool);
      const [before] = (await connectionA.query<{ next_allowed_at: Date }>(
        `select next_allowed_at from event_location_search_rate_gate where key = 'nominatim'`,
      )).rows;
      const outcomes = await Promise.all([gateA.tryAcquire(), gateB.tryAcquire()]);
      expect(outcomes.filter(Boolean)).toHaveLength(1);
      expect(await gateA.tryAcquire()).toBe(false);

      const [after] = (await connectionA.query<{ next_allowed_at: Date; elapsed_ms: number }>(
        `select next_allowed_at, extract(epoch from (next_allowed_at - $1::timestamptz)) * 1000 as elapsed_ms
         from event_location_search_rate_gate where key = 'nominatim'`,
        [before?.next_allowed_at],
      )).rows;
      expect(Number(after?.elapsed_ms)).toBeGreaterThanOrEqual(900);
      expect(Number(after?.elapsed_ms)).toBeLessThan(5_000);
    } finally {
      connectionA.release();
      connectionB.release();
    }
  });

  test('database checks reject residences and preserve exact coordinates outside the event row', async () => {
    await expect(database.pool.query(`
      insert into event (
        id, host_account_id, venue_type, non_residential_host_declaration, capacity, admission_mode
      ) values ('40000000-0000-7000-8000-000000000025', $1, 'public_place', false, 8, 'manual_approval')
    `, [ACCOUNT_ID])).rejects.toMatchObject({ code: '23514' });

    await database.pool.query(`
      insert into event_exact_location (event_id, ciphertext, iv, auth_tag)
      values ('40000000-0000-7000-8000-000000000026', decode('deadbeef', 'hex'), decode(repeat('01', 12), 'hex'), decode(repeat('04', 16), 'hex'))
    `);

    const [eventRow] = await query<{ approximate_latitude: number; approximate_longitude: number; approximate_radius_meters: number }>(
      `select approximate_latitude, approximate_longitude, approximate_radius_meters from event where id = '40000000-0000-7000-8000-000000000026'`,
    );
    const [exactRow] = await query<{ ciphertext: string; iv_length: number; auth_tag_length: number }>(
      `select encode(ciphertext, 'hex') as ciphertext, octet_length(iv) as iv_length, octet_length(auth_tag) as auth_tag_length from event_exact_location where event_id = '40000000-0000-7000-8000-000000000026'`,
    );

    expect(eventRow).toEqual({ approximate_latitude: -8.045, approximate_longitude: -34.875, approximate_radius_meters: 500 });
    expect(exactRow).toEqual({ ciphertext: 'deadbeef', iv_length: 12, auth_tag_length: 16 });
  });

  test('revision compare-and-set admits one writer', async () => {
    const update = () => database.pool.query(
      `update event set title = $1, revision = revision + 1 where id = '40000000-0000-7000-8000-000000000026' and revision = 1 returning revision`,
      ['Caminhada atualizada'],
    );
    const first = await update();
    const second = await update();
    expect(first.rows).toEqual([{ revision: 2 }]);
    expect(second.rows).toEqual([]);
  });
});
