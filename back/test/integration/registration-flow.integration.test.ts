import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { ListActiveInterests } from '../../src/modules/catalog/application/use-cases/list-active-interests.use-case';
import { CatalogModule } from '../../src/modules/catalog/catalog.module';
import { ProfilesModule } from '../../src/modules/profiles/profiles.module';
import type { FlowCredentials } from '../../src/modules/registration/application/services/registration-flow-gate';
import { CheckRegistrationEligibility } from '../../src/modules/registration/application/use-cases/check-registration-eligibility.use-case';
import { ExpireStaleRegistrations } from '../../src/modules/registration/application/use-cases/expire-stale-registrations.use-case';
import { CancelRegistration } from '../../src/modules/registration/application/use-cases/cancel-registration.use-case';
import { ListCurrentLegalDocuments } from '../../src/modules/registration/application/use-cases/list-current-legal-documents.use-case';
import { RegistrationFlow } from '../../src/modules/registration/application/use-cases/registration-flow.use-case';
import { REGISTRATION_TELEMETRY_PORT } from '../../src/modules/registration/domain/ports/outbound/registration-telemetry.port';
import { CLOCK_PORT } from '../../src/modules/registration/domain/ports/outbound/runtime.ports';
import { VERIFICATION_DELIVERY_PORT } from '../../src/modules/registration/domain/ports/outbound/security.ports';
import { RegistrationModule } from '../../src/modules/registration/registration.module';
import { validateEnv } from '../../src/shared/infrastructure/config/env';
import { createEphemeralDatabase, MIGRATIONS_CONFIG, type EphemeralDatabase } from '../support/ephemeral-database';
import { CapturingDelivery, CapturingTelemetry, FakeClock } from '../support/registration-fakes';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

const MINUTE = 60_000;
const ORIGIN = Buffer.alloc(32, 9);
const PASSWORD = 'uma senha longa e rara';
const BIRTH_DATE = '1990-05-10';
const DOCUMENT_IDS = [
  '10000000-0000-7000-8000-000000000011',
  '10000000-0000-7000-8000-000000000012',
  '10000000-0000-7000-8000-000000000013',
];
const INTEREST_IDS = [1, 2, 3].map((n) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`);

/** One Nest container with its own single-connection pool, like one API replica. */
async function createNode(clock: FakeClock, delivery: CapturingDelivery, telemetry: CapturingTelemetry) {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: validateEnv }),
      ProfilesModule,
      CatalogModule,
      RegistrationModule,
    ],
  })
    .overrideProvider(CLOCK_PORT)
    .useValue(clock)
    .overrideProvider(VERIFICATION_DELIVERY_PORT)
    .useValue(delivery)
    .overrideProvider(REGISTRATION_TELEMETRY_PORT)
    .useValue(telemetry)
    .compile();
  await module.init();
  return {
    module,
    eligibility: module.get(CheckRegistrationEligibility),
    flow: module.get(RegistrationFlow),
    expireStale: module.get(ExpireStaleRegistrations),
    interests: module.get(ListActiveInterests),
    documents: module.get(ListCurrentLegalDocuments),
    cancel: module.get(CancelRegistration),
  };
}

type Node = Awaited<ReturnType<typeof createNode>>;

describe('registration HTTP flow (PostgreSQL integration)', () => {
  let database: EphemeralDatabase;
  let nodeA: Node;
  let nodeB: Node;
  let keys = 0;
  const clock = new FakeClock(new Date());
  const delivery = new CapturingDelivery();
  const telemetry = new CapturingTelemetry();

  const query = async <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
    (await database.pool.query<T>(text, values)).rows;
  const as = (token: string, idempotencyKey = `integration-key-${String((keys += 1)).padStart(6, '0')}`): FlowCredentials => ({
    token,
    idempotencyKey,
  });

  async function eligible(node: Node): Promise<string> {
    const result = await node.eligibility.execute({ birthDate: BIRTH_DATE });
    if (!result.eligible) throw new Error('expected eligibility');
    return result.continuation;
  }

  async function verified(node: Node, contact: string): Promise<string> {
    const token = await eligible(node);
    await node.flow.requestContactVerification(as(token), { contact, originFingerprint: ORIGIN });
    return (await node.flow.confirmContact(as(token), { otp: delivery.lastOtp() })).continuation!;
  }

  beforeAll(async () => {
    database = await createEphemeralDatabase(adminUrl);
    process.env.DATABASE_URL = database.url;
    process.env.DATABASE_SSL_MODE = 'disable';
    nodeA = await createNode(clock, delivery, telemetry);
    nodeB = await createNode(clock, delivery, telemetry);
  });

  afterAll(async () => {
    await nodeA?.module.close();
    await nodeB?.module.close();
    await database?.drop();
  });

  describe('migration 0003 constraints', () => {
    test('rejects sessions whose bindings do not match the stage', async () => {
      const insert = (stage: string, verificationId: string | null) =>
        database.pool.query(
          `insert into registration_flow_session (id, token_digest, stage, verification_id, expires_at, updated_at)
           values (gen_random_uuid(), gen_random_uuid()::text::bytea, $1, $2, now(), now())`,
          [stage, verificationId],
        );
      await expect(insert('contact_verified', null)).rejects.toMatchObject({ code: '23514' });
      await expect(insert('unknown', null)).rejects.toMatchObject({ code: '23514' });
      await expect(insert('verification_pending', null)).resolves.toMatchObject({ rowCount: 1 });
    });

    test('a completed session cannot keep a token and a previous token needs its deadline', async () => {
      await expect(
        database.pool.query(
          `insert into registration_flow_session (id, token_digest, stage, expires_at, updated_at, previous_token_digest)
           values (gen_random_uuid(), '\\x01', 'age_eligible', now(), now(), '\\x02')`,
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    test('an idempotency outcome exists exactly when it is completed', async () => {
      const [session] = await query<{ id: string }>(
        `insert into registration_flow_session (id, token_digest, stage, expires_at, updated_at)
         values (gen_random_uuid(), gen_random_uuid()::text::bytea, 'age_eligible', now(), now()) returning id`,
      );
      await expect(
        database.pool.query(
          `insert into registration_idempotency (id, flow_session_id, operation, key_hash, request_hash, response_body, expires_at)
           values (gen_random_uuid(), $1, 'password', '\\x01', '\\x02', '{}', now())`,
          [session?.id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('flow', () => {
    test('activates end to end and leaves no token, birth date or contact outside the account', async () => {
      for (const [index, kind] of ['terms', 'privacy', 'community_rules'].entries()) {
        await query(
          `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status)
           values ($1, $2, 'flow-test', 'pt-BR', now() - interval '1 hour', sha256(convert_to('# fixture', 'UTF8')), '# fixture', 'approved')`,
          [DOCUMENT_IDS[index], kind],
        );
      }
      const password = await nodeA.flow.choosePassword(as(await verified(nodeA, 'flow@example.test')), { password: PASSWORD });
      // Another replica continues the journey: state lives only in PostgreSQL.
      const required = await nodeB.flow.saveRequiredData(as(password.continuation!), {
        displayName: 'Ana',
        ufCode: 'PE',
        municipalityCode: '2611606',
        usageIntents: ['friendship'],
      });
      await nodeA.flow.complete(as(required.continuation!), {
        birthDate: BIRTH_DATE,
        documentIds: DOCUMENT_IDS,
        interestIds: INTEREST_IDS,
      });

      const [session] = await query<{ stage: string; token_digest: Buffer | null; revoked_at: Date | null }>(
        `select stage, token_digest, revoked_at from registration_flow_session where account_id is not null`,
      );
      expect(session).toMatchObject({ stage: 'completed', token_digest: null });
      expect(session?.revoked_at).not.toBeNull();

      const dump = JSON.stringify(
        await query(`select s.*, i.* from registration_flow_session s left join registration_idempotency i on i.flow_session_id = s.id`),
      );
      for (const secret of [BIRTH_DATE, PASSWORD, 'flow@example.test', password.continuation!, required.continuation!]) {
        expect(dump).not.toContain(secret);
      }
      // Accepted documents are referenced forever; retiring them keeps later reads empty.
      await query(`update terms_document set status = 'retired' where id = any($1::uuid[])`, [DOCUMENT_IDS]);
    });

    test('cancelling after the password expires the registration and frees the contact (ADR-030)', async () => {
      const contact = 'cancel@example.test';
      const password = await nodeA.flow.choosePassword(as(await verified(nodeA, contact)), { password: PASSWORD });

      // Another replica handles the cancellation: state lives only in PostgreSQL.
      await nodeB.cancel.execute(password.continuation!);

      const [registration] = await query<{ status: string; contact_hash: Buffer | null; password_hash: string | null }>(
        `select r.status, r.contact_hash, r.password_hash from registration r
         join registration_flow_session s on s.registration_id = r.id
         where s.revoked_at is not null and s.stage = 'registration_in_progress'`,
      );
      expect(registration).toEqual({ status: 'expired', contact_hash: null, password_hash: null });
      const [session] = await query<{ token_digest: Buffer | null; revoked_at: Date | null }>(
        `select token_digest, revoked_at from registration_flow_session where stage = 'registration_in_progress' and revoked_at is not null`,
      );
      expect(session?.token_digest).toBeNull();
      expect(session?.revoked_at).not.toBeNull();
      await expect(nodeA.flow.snapshot(password.continuation!)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });

      // The same e-mail can start over.
      const again = await verified(nodeA, contact);
      await expect(nodeA.flow.choosePassword(as(again), { password: PASSWORD })).resolves.toBeDefined();
    });

    test('concurrent replicas with the same key produce one registration', async () => {
      const token = await verified(nodeA, 'race@example.test');
      const credentials = as(token);

      const results = await Promise.allSettled([
        nodeA.flow.choosePassword(credentials, { password: PASSWORD }),
        nodeB.flow.choosePassword(credentials, { password: PASSWORD }),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      for (const result of results) {
        if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      }
      const [registrations] = await query<{ count: string }>(
        `select count(*)::text as count from registration r
         join registration_flow_session s on s.registration_id = r.id where s.stage = 'registration_in_progress'
           and r.verification_id = s.verification_id and s.id in (
             select flow_session_id from registration_idempotency where operation = 'password')`,
      );
      expect(Number(registrations?.count)).toBeGreaterThanOrEqual(1);
      const [sessions] = await query<{ count: string }>(
        `select count(distinct registration_id)::text as count from registration_flow_session
         where verification_id = (select verification_id from registration_flow_session where registration_id is not null
                                  order by updated_at desc limit 1)`,
      );
      expect(sessions?.count).toBe('1');
    });

    test('concurrent replicas with different keys cannot both advance the stage', async () => {
      const token = await verified(nodeA, 'stage-race@example.test');
      const results = await Promise.allSettled([
        nodeA.flow.choosePassword(as(token), { password: PASSWORD }),
        nodeB.flow.choosePassword(as(token), { password: PASSWORD }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected');
      expect(rejected?.status === 'rejected' ? rejected.reason.code : null).toMatch(
        /FLOW_STAGE_CONFLICT|VERIFICATION_UNAVAILABLE|FLOW_UNAUTHORIZED/,
      );
    });

    test('the e-mail link works across replicas and only once', async () => {
      const token = await eligible(nodeA);
      await nodeA.flow.requestContactVerification(as(token), { contact: 'link@example.test', originFingerprint: ORIGIN });
      const link = delivery.lastLinkToken();

      const [first, second] = await Promise.all([
        nodeA.flow.confirmContactByLink({ token: link }),
        nodeB.flow.confirmContactByLink({ token: link }),
      ]);
      expect([first.body.verified, second.body.verified].sort()).toEqual([false, true]);
      const [row] = await query<{ link_token_digest: Buffer | null; status: string }>(
        `select link_token_digest, status from contact_verification where id = (
           select verification_id from registration_flow_session where id = (
             select id from registration_flow_session where stage = 'contact_verified' order by updated_at desc limit 1))`,
      );
      expect(row).toEqual({ link_token_digest: null, status: 'verified' });
    });
  });

  describe('origin limit (ADR-023)', () => {
    test('persists only the fingerprint and answers neutrally after ten challenges', async () => {
      const origin = Buffer.alloc(32, 42);
      for (let index = 0; index < 10; index += 1) {
        const token = await eligible(index % 2 ? nodeA : nodeB);
        await nodeA.flow.requestContactVerification(as(token), { contact: `origem${index}@example.test`, originFingerprint: origin });
      }
      const before = await query<{ count: string }>(`select count(*)::text as count from contact_verification`);
      const token = await eligible(nodeA);
      const result = await nodeB.flow.requestContactVerification(as(token), { contact: 'origem-extra@example.test', originFingerprint: origin });

      expect(Object.keys(result.body).sort()).toEqual(['expiresAt', 'nextResendAt']);
      expect(await query(`select count(*)::text as count from contact_verification`)).toEqual(before);
      const [window] = await query<{ request_count: number }>(
        `select request_count from verification_rate_window where scope = 'origin' and subject_hash = $1`,
        [origin],
      );
      expect(window?.request_count).toBe(10);
      const columns = await query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and column_name ~ '(^|_)(ip|ip_address|remote_addr)(_|$)'`,
      );
      expect(columns).toEqual([]);
    });
  });

  describe('reads', () => {
    test('lists active interests in stable order and only approved documents', async () => {
      const interests = await nodeA.interests.execute();
      expect(interests).toHaveLength(20);
      expect(interests[0]).toEqual({ id: INTEREST_IDS[0], slug: 'cafe-e-gastronomia', label: 'Café e gastronomia' });

      await query(
        `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status) values
         (gen_random_uuid(), 'terms', 'placeholder-v1', 'pt-BR', now(), '\\x00', null, 'placeholder'),
         (gen_random_uuid(), 'privacy', 'retired-v1', 'pt-BR', now(), '\\x00', null, 'retired')`,
      );
      const documents = await nodeA.documents.execute({ locale: 'pt-BR' });
      // Only the three seeded approved versions are offered, without frontmatter (ADR-028).
      expect(documents.map((document) => document.kind)).toEqual(['community_rules', 'privacy', 'terms']);
      expect(documents.every((document) => document.version === '1.0.0' && !document.body.startsWith('---'))).toBe(true);
    });
  });

  test('stale expiration nulls expired session digests without deleting rows', async () => {
    await eligible(nodeA);
    const [before] = await query<{ count: string }>(`select count(*)::text as count from registration_flow_session`);
    clock.advance(31 * MINUTE);
    await nodeA.expireStale.execute(1_000);
    expect((await query(`select count(*)::text as count from registration_flow_session`))[0]).toEqual(before);
    const [expired] = await query<{ count: string }>(
      `select count(*)::text as count from registration_flow_session where expires_at <= $1 and token_digest is not null`,
      [clock.now()],
    );
    expect(expired?.count).toBe('0');
  });
});

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

describe('migration 0003 over 0002 data', () => {
  let database: EphemeralDatabase;
  let folder: string;

  beforeAll(async () => {
    folder = partialMigrationsFolder(3);
    database = await createEphemeralDatabase(adminUrl, { initialMigrationsFolder: folder });
  });

  afterAll(async () => {
    await database?.drop();
    rmSync(folder, { recursive: true, force: true });
  });

  test('is additive: existing challenges keep their data and gain no link', async () => {
    await database.pool.query(
      `insert into contact_verification (id, purpose, channel, contact_hash, contact_ciphertext, otp_digest,
         expires_at, last_sent_at, delivery_idempotency_key, status)
       values ('00000000-0000-7000-8000-0000000000aa', 'registration', 'email', '\\x0a', '\\x0b', '\\x0c',
         now(), now(), gen_random_uuid(), 'open')`,
    );

    await database.migrate();

    const { rows } = await database.pool.query(
      `select contact_hash, link_token_digest from contact_verification where id = '00000000-0000-7000-8000-0000000000aa'`,
    );
    expect(rows).toEqual([{ contact_hash: Buffer.from([0x0a]), link_token_digest: null }]);
    const tables = await database.pool.query(
      `select table_name from information_schema.tables where table_name like 'registration_%' order by table_name`,
    );
    expect(tables.rows.map((row: { table_name: string }) => row.table_name)).toEqual([
      'registration_flow_session',
      'registration_idempotency',
    ]);
  });
});
