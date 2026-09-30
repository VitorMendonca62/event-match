import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { AuthenticateAccount } from '../../src/modules/identity-access/application/use-cases/authenticate-account.use-case';
import { Logout } from '../../src/modules/identity-access/application/use-cases/logout.use-case';
import { ResolveAuthenticatedSession } from '../../src/modules/identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { IdentityAccessError } from '../../src/modules/identity-access/domain/errors/identity-access.error';
import { ACCOUNT_ACCESS_POLICY_PORT } from '../../src/modules/identity-access/domain/ports/outbound/account-access-policy.port';
import { AUTHENTICATION_TELEMETRY_PORT } from '../../src/modules/identity-access/domain/ports/outbound/authentication-telemetry.port';
import { IDENTITY_CLOCK_PORT } from '../../src/modules/identity-access/domain/ports/outbound/runtime.ports';
import { IdentityAccessModule } from '../../src/modules/identity-access/identity-access.module';
import { ContactIdentifier } from '../../src/modules/registration/domain/value-objects/contact-identifier';
import { ContactProtectorAdapter } from '../../src/modules/registration/infrastructure/security/contact-protector.adapter';
import { validateEnv } from '../../src/shared/infrastructure/config/env';
import { createEphemeralDatabase, MIGRATIONS_CONFIG, type EphemeralDatabase } from '../support/ephemeral-database';
import {
  CapturingAuthTelemetry,
  DAY,
  FakeAccessPolicy,
  FakeIdentityClock,
  MINUTE,
} from '../support/identity-access-fakes';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

const PASSWORD = 'uma senha longa e rara';
const ORIGIN = Buffer.alloc(32, 9);

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    if (error instanceof IdentityAccessError) return error.code;
    throw error;
  }
}

/** One Nest container with its own single-connection pool, like one API replica. */
async function createNode(url: string, clock: FakeIdentityClock, policy: FakeAccessPolicy, telemetry: CapturingAuthTelemetry) {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        validate: (environment) => validateEnv({ ...environment, DATABASE_URL: url }),
      }),
      IdentityAccessModule,
    ],
  })
    .overrideProvider(IDENTITY_CLOCK_PORT)
    .useValue(clock)
    .overrideProvider(ACCOUNT_ACCESS_POLICY_PORT)
    .useValue(policy)
    .overrideProvider(AUTHENTICATION_TELEMETRY_PORT)
    .useValue(telemetry)
    .compile();
  await module.init();
  return {
    module,
    authenticate: module.get(AuthenticateAccount),
    resolve: module.get(ResolveAuthenticatedSession),
    logout: module.get(Logout),
  };
}

type Node = Awaited<ReturnType<typeof createNode>>;

describe('identity-access (PostgreSQL integration)', () => {
  let database: EphemeralDatabase;
  let nodeA: Node;
  let nodeB: Node;
  const clock = new FakeIdentityClock(new Date());
  const policy = new FakeAccessPolicy();
  const telemetry = new CapturingAuthTelemetry();
  const protector = new ContactProtectorAdapter(new ConfigService(validateEnv(process.env)) as ConfigService<never, true>);
  let passwordHash: string;
  let sequence = 0;

  const query = async <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
    (await database.pool.query<T>(text, values)).rows;

  /** An account exactly as registration leaves it after activation. */
  async function createAccount(email: string, status = 'active'): Promise<string> {
    sequence += 1;
    const suffix = sequence.toString(16).padStart(12, '0');
    const [verificationId, registrationId, accountId] = ['1', '2', '3'].map((p) => `${p}0000000-0000-7000-8000-${suffix}`);
    const contact = ContactIdentifier.create('email', email);
    const sealed = protector.seal(contact);
    await query(
      `insert into contact_verification (id, purpose, channel, contact_hash, contact_ciphertext, otp_digest,
         expires_at, last_sent_at, delivery_idempotency_key, status)
       values ($1, 'registration', 'email', $2, $3, '\\x01', now(), now(), gen_random_uuid(), 'consumed')`,
      [verificationId, protector.blindIndex(contact), sealed.ciphertext],
    );
    await query(
      `insert into registration (id, verification_id, channel, status, last_updated_at, expires_at)
       values ($1, $2, 'email', 'converted', now(), now())`,
      [registrationId, verificationId],
    );
    await query(
      `insert into account (id, registration_id, status, birth_date, last_updated_at, activated_at)
       values ($1, $2, $3, '1990-05-10', now(), now())`,
      [accountId, registrationId, status],
    );
    await query(
      `insert into account_contact (account_id, channel, contact_hash, contact_ciphertext, confirmed_at)
       values ($1, 'email', $2, $3, now())`,
      [accountId, protector.blindIndex(contact), sealed.ciphertext],
    );
    await query(
      `insert into account_credential (account_id, password_hash, algorithm, updated_at) values ($1, $2, 'argon2id', now())`,
      [accountId, passwordHash],
    );
    return accountId!;
  }

  const login = (node: Node, email: string, overrides: Partial<{ password: string; rememberMe: boolean; origin: Buffer }> = {}) =>
    node.authenticate.execute({
      email,
      password: overrides.password ?? PASSWORD,
      rememberMe: overrides.rememberMe ?? false,
      originFingerprint: overrides.origin ?? ORIGIN,
    });
  const resolve = (node: Node, token: string, allowRotation = false) =>
    node.resolve.execute({ token, capability: 'authenticated_home', allowRotation });

  beforeAll(async () => {
    passwordHash = await Bun.password.hash(PASSWORD, { algorithm: 'argon2id' });
    database = await createEphemeralDatabase(adminUrl);
    nodeA = await createNode(database.url, clock, policy, telemetry);
    nodeB = await createNode(database.url, clock, policy, telemetry);
  });

  afterAll(async () => {
    await nodeA?.module.close();
    await nodeB?.module.close();
    await database?.drop();
  });

  beforeEach(async () => {
    policy.denied.clear();
    // A fresh origin per test keeps the 30/origin bucket independent between scenarios.
    await query('delete from authentication_attempt');
  });

  test('schema: HMAC-only sessions, widened status check, indexes and constraints', async () => {
    const columns = await query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_name in ('authenticated_session', 'authentication_attempt') order by 1, 2`,
    );
    expect(columns.map((row) => `${row.table_name}.${row.column_name}`)).toEqual([
      'authenticated_session.absolute_expires_at',
      'authenticated_session.account_id',
      'authenticated_session.created_at',
      'authenticated_session.id',
      'authenticated_session.idle_timeout_seconds',
      'authenticated_session.last_seen_at',
      'authenticated_session.previous_token_digest',
      'authenticated_session.previous_valid_until',
      'authenticated_session.remembered',
      'authenticated_session.rotated_at',
      'authenticated_session.token_digest',
      'authentication_attempt.attempted_at',
      'authentication_attempt.id',
      'authentication_attempt.scope',
      'authentication_attempt.subject_hash',
    ]);
    const indexes = await query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename in ('authenticated_session', 'authentication_attempt') order by 1`,
    );
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'authenticated_session_token_digest_unique',
        'authenticated_session_previous_token_digest_unique',
        'authenticated_session_account_last_seen_index',
        'authentication_attempt_subject_index',
      ]),
    );
    for (const status of ['suspended', 'deleted', 'recovery_restricted']) {
      await expect(createAccount(`${status}-schema@example.test`, status)).resolves.toBeDefined();
    }
    await expect(createAccount('invalid-status@example.test', 'banned')).rejects.toThrow();
    await expect(
      query(`insert into authentication_attempt (id, scope, subject_hash, attempted_at) values (gen_random_uuid(), 'ip', '\\x01', now())`),
    ).rejects.toThrow();
  });

  test('login stores only the digest, releases the reservation and resolves on another replica', async () => {
    const accountId = await createAccount('ana@example.test');
    const result = await login(nodeA, 'ANA@example.test');
    const rows = await query<{ token_digest: Buffer; account_id: string; idle_timeout_seconds: number }>(
      'select token_digest, account_id, idle_timeout_seconds from authenticated_session where account_id = $1',
      [accountId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.idle_timeout_seconds).toBe(1800);
    expect(rows[0]?.token_digest.toString('base64url')).not.toBe(result.token);
    const dump = JSON.stringify(await query('select * from authenticated_session'));
    expect(dump).not.toContain(result.token);
    expect(await query('select 1 from authentication_attempt')).toHaveLength(0);
    await expect(resolve(nodeB, result.token)).resolves.toMatchObject({ accountId });
  });

  test('neutral refusals keep their reservation; the contact bucket is exact under concurrency', async () => {
    await createAccount('bia@example.test');
    const origin = Buffer.alloc(32, 21);
    const attempts = Array.from({ length: 10 }, (_, index) =>
      code(login(index % 2 ? nodeA : nodeB, 'bia@example.test', { password: 'errada', origin })),
    );
    const codes = await Promise.all(attempts);
    expect(codes.filter((value) => value === 'INVALID_CREDENTIALS')).toHaveLength(5);
    expect(codes.filter((value) => value === 'RATE_LIMITED')).toHaveLength(5);
    // Nonexistent contacts consume the same way.
    const ghost = await Promise.all(
      Array.from({ length: 7 }, () => code(login(nodeA, 'ninguem@example.test', { origin: Buffer.alloc(32, 22) }))),
    );
    expect(ghost.filter((value) => value === 'INVALID_CREDENTIALS')).toHaveLength(5);

    clock.advance(15 * MINUTE + 1);
    await expect(login(nodeA, 'bia@example.test', { origin })).resolves.toBeDefined();
  });

  test('the origin bucket stops at 30 failures across contacts and replicas', async () => {
    const origin = Buffer.alloc(32, 23);
    const codes = await Promise.all(
      Array.from({ length: 36 }, (_, index) =>
        code(login(index % 2 ? nodeA : nodeB, `varredura${index}@example.test`, { origin })),
      ),
    );
    expect(codes.filter((value) => value === 'INVALID_CREDENTIALS')).toHaveLength(30);
    expect(codes.filter((value) => value === 'RATE_LIMITED')).toHaveLength(6);
  });

  test('opportunistic cleanup removes a bounded global batch of expired attempts', async () => {
    const staleAt = new Date(clock.now().getTime() - 15 * MINUTE - 1);
    await query(
      `insert into authentication_attempt (id, scope, subject_hash, attempted_at)
       select gen_random_uuid(), case when value % 2 = 0 then 'contact' else 'origin' end,
              decode(lpad(to_hex(value), 64, '0'), 'hex'), $1
       from generate_series(1, 101) as values_to_insert(value)`,
      [staleAt],
    );
    await query(
      `insert into authentication_attempt (id, scope, subject_hash, attempted_at)
       values (gen_random_uuid(), 'contact', $1, $2)`,
      [Buffer.alloc(32, 255), clock.now()],
    );
    await createAccount('cleanup@example.test');

    await login(nodeA, 'cleanup@example.test', { origin: Buffer.alloc(32, 30) });
    expect(await query('select 1 from authentication_attempt where attempted_at <= $1', [staleAt])).toHaveLength(1);
    expect(await query('select 1 from authentication_attempt where attempted_at > $1', [staleAt])).toHaveLength(1);

    await login(nodeB, 'cleanup@example.test', { origin: Buffer.alloc(32, 31) });
    expect(await query('select 1 from authentication_attempt where attempted_at <= $1', [staleAt])).toHaveLength(0);
    expect(await query('select 1 from authentication_attempt where attempted_at > $1', [staleAt])).toHaveLength(1);
  });

  test('repeated successful logins never produce 429', async () => {
    await createAccount('caio@example.test');
    const origin = Buffer.alloc(32, 24);
    for (let attempt = 0; attempt < 8; attempt += 1) await login(attempt % 2 ? nodeA : nodeB, 'caio@example.test', { origin });
    expect(await query('select 1 from authentication_attempt')).toHaveLength(0);
  });

  test('concurrent logins near the limit never leave more than five sessions', async () => {
    const accountId = await createAccount('duda@example.test');
    const origin = Buffer.alloc(32, 25);
    for (let index = 0; index < 4; index += 1) {
      await login(nodeA, 'duda@example.test', { origin });
      clock.advance(1_000);
    }
    await Promise.all([login(nodeA, 'duda@example.test', { origin }), login(nodeB, 'duda@example.test', { origin })]);
    const [row] = await query<{ total: string }>('select count(*) as total from authenticated_session where account_id = $1', [
      accountId,
    ]);
    expect(Number(row?.total)).toBe(5);
  });

  test('rotation: one winner across replicas, previous digest only during the grace', async () => {
    await createAccount('eva@example.test');
    const { token } = await login(nodeA, 'eva@example.test', { rememberMe: true, origin: Buffer.alloc(32, 26) });
    clock.advance(DAY);

    const results = await Promise.all([resolve(nodeA, token, true), resolve(nodeB, token, true)]);
    const winners = results.filter((result) => result.rotatedToken);
    expect(winners).toHaveLength(1);
    const rotated = winners[0]!.rotatedToken!;
    expect(results.every((result) => result.expiresAt.getTime() === results[0]!.expiresAt.getTime())).toBe(true);

    // The previous digest finishes in-flight requests but never rotates nor receives the new token.
    const late = await resolve(nodeB, token, true);
    expect(late.rotatedToken).toBeNull();
    const dump = JSON.stringify(await query('select * from authenticated_session'));
    expect(dump).not.toContain(rotated);
    expect(dump).not.toContain(token);

    clock.advance(MINUTE);
    expect(await code(resolve(nodeA, token))).toBe('SESSION_REVOKED');
    await expect(resolve(nodeA, rotated)).resolves.toBeDefined();
  });

  test('idle expiry, coalesced activity, logout and reuse', async () => {
    const accountId = await createAccount('fabi@example.test');
    const { token } = await login(nodeA, 'fabi@example.test', { origin: Buffer.alloc(32, 27) });
    const seen = async () =>
      (await query<{ last_seen_at: Date }>('select last_seen_at from authenticated_session where account_id = $1', [accountId]))[0]
        ?.last_seen_at;
    const created = await seen();

    clock.advance(4 * MINUTE);
    await resolve(nodeA, token);
    expect(await seen()).toEqual(created);
    clock.advance(2 * MINUTE);
    await resolve(nodeB, token);
    expect((await seen())?.getTime()).toBe(clock.now().getTime());

    clock.advance(30 * MINUTE);
    expect(await code(resolve(nodeA, token))).toBe('SESSION_EXPIRED');
    expect(await seen()).toBeUndefined();

    const second = await login(nodeA, 'fabi@example.test', { origin: Buffer.alloc(32, 27) });
    await nodeB.logout.execute({ token: second.token });
    expect(await code(resolve(nodeA, second.token))).toBe('SESSION_REVOKED');
    await expect(nodeA.logout.execute({ token: second.token })).resolves.toEqual({ loggedOut: true });
  });

  test('a status change between requests is 401 with revocation; a denied capability is 403 and keeps it', async () => {
    const accountId = await createAccount('gil@example.test');
    const origin = Buffer.alloc(32, 28);
    const first = await login(nodeA, 'gil@example.test', { origin });
    await query(`update account set status = 'suspended' where id = $1`, [accountId]);
    expect(await code(resolve(nodeB, first.token))).toBe('SESSION_REVOKED');
    expect(await query('select 1 from authenticated_session where account_id = $1', [accountId])).toHaveLength(0);
    expect(await code(login(nodeA, 'gil@example.test', { origin }))).toBe('INVALID_CREDENTIALS');

    await query(`update account set status = 'active' where id = $1`, [accountId]);
    const second = await login(nodeA, 'gil@example.test', { origin });
    policy.denied.add('authenticated_home');
    expect(await code(resolve(nodeA, second.token))).toBe('CAPABILITY_DENIED');
    expect(await query('select 1 from authenticated_session where account_id = $1', [accountId])).toHaveLength(1);
  });

  test('opportunistic cleanup removes expired sessions of other accounts on login', async () => {
    const accountId = await createAccount('hana@example.test');
    const origin = Buffer.alloc(32, 29);
    await login(nodeA, 'hana@example.test', { origin });
    clock.advance(13 * 60 * MINUTE);
    await createAccount('iara@example.test');
    await login(nodeB, 'iara@example.test', { origin });
    expect(await query('select 1 from authenticated_session where account_id = $1', [accountId])).toHaveLength(0);
  });
});

describe('migration 0006 over existing 0005 data', () => {
  let database: EphemeralDatabase;
  let folder: string;

  beforeAll(async () => {
    folder = mkdtempSync(join(tmpdir(), 'eventmatch-migrations-'));
    cpSync(MIGRATIONS_CONFIG.migrationsFolder, folder, { recursive: true });
    const journalPath = join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
    journal.entries = journal.entries.filter((entry) => entry.tag !== '0006_authenticated_session');
    writeFileSync(journalPath, JSON.stringify(journal));
    database = await createEphemeralDatabase(adminUrl, { initialMigrationsFolder: folder });
  });

  afterAll(async () => {
    await database?.drop();
    rmSync(folder, { recursive: true, force: true });
  });

  test('keeps existing accounts and only widens the status check', async () => {
    const run = (text: string) => database.pool.query(text);
    await run(`insert into contact_verification (id, purpose, channel, contact_hash, contact_ciphertext, otp_digest,
                 expires_at, last_sent_at, delivery_idempotency_key, status)
               values ('10000000-0000-7000-8000-000000000001', 'registration', 'email', '\\x01', '\\x01', '\\x01',
                 now(), now(), gen_random_uuid(), 'consumed')`);
    await run(`insert into registration (id, verification_id, channel, status, last_updated_at, expires_at)
               values ('20000000-0000-7000-8000-000000000001', '10000000-0000-7000-8000-000000000001', 'email', 'converted', now(), now())`);
    await run(`insert into account (id, registration_id, status, birth_date, last_updated_at, activated_at)
               values ('30000000-0000-7000-8000-000000000001', '20000000-0000-7000-8000-000000000001', 'active', '1990-05-10', now(), now())`);
    await expect(run(`update account set status = 'suspended'`)).rejects.toThrow();

    await database.migrate();

    const accounts = await run(`select status from account`);
    expect(accounts.rows).toEqual([{ status: 'active' }]);
    await run(`update account set status = 'suspended'`);
    await expect(run(`update account set status = 'banned'`)).rejects.toThrow();
    expect((await run(`select to_regclass('authenticated_session') as name`)).rows[0]).toEqual({ name: 'authenticated_session' });
  });
});
