import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { CatalogModule } from '../../src/modules/catalog/catalog.module';
import { ProfilesModule } from '../../src/modules/profiles/profiles.module';
import { CompleteRegistration } from '../../src/modules/registration/application/use-cases/complete-registration.use-case';
import { ExpireStaleRegistrations } from '../../src/modules/registration/application/use-cases/expire-stale-registrations.use-case';
import { RequestContactVerification } from '../../src/modules/registration/application/use-cases/request-contact-verification.use-case';
import { ResendContactVerification } from '../../src/modules/registration/application/use-cases/resend-contact-verification.use-case';
import { SaveRequiredData } from '../../src/modules/registration/application/use-cases/save-required-data.use-case';
import { StartRegistration } from '../../src/modules/registration/application/use-cases/start-registration.use-case';
import { VerifyContact } from '../../src/modules/registration/application/use-cases/verify-contact.use-case';
import { REGISTRATION_TELEMETRY_PORT } from '../../src/modules/registration/domain/ports/outbound/registration-telemetry.port';
import { CLOCK_PORT } from '../../src/modules/registration/domain/ports/outbound/runtime.ports';
import { VERIFICATION_DELIVERY_PORT } from '../../src/modules/registration/domain/ports/outbound/security.ports';
import { RegistrationModule } from '../../src/modules/registration/registration.module';
import { validateEnv } from '../../src/shared/infrastructure/config/env';
import { createEphemeralDatabase, type EphemeralDatabase } from '../support/ephemeral-database';
import { CapturingDelivery, CapturingTelemetry, FakeClock } from '../support/registration-fakes';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

const DAY = 24 * 60 * 60_000;
const PASSWORD = 'uma senha longa e rara';
const REGISTRATION_TABLES = [
  'account',
  'account_contact',
  'account_credential',
  'account_interest',
  'contact_verification',
  'interest',
  'profile',
  'profile_usage_intent',
  'registration',
  'terms_acceptance',
  'terms_document',
  'verification_rate_window',
];
const DOCUMENT_IDS = [
  '10000000-0000-7000-8000-000000000001',
  '10000000-0000-7000-8000-000000000002',
  '10000000-0000-7000-8000-000000000003',
];
const INTEREST_IDS = [1, 2, 3, 4].map((n) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`);

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
    request: module.get(RequestContactVerification),
    resend: module.get(ResendContactVerification),
    verify: module.get(VerifyContact),
    start: module.get(StartRegistration),
    saveRequiredData: module.get(SaveRequiredData),
    complete: module.get(CompleteRegistration),
    expireStale: module.get(ExpireStaleRegistrations),
  };
}

type Node = Awaited<ReturnType<typeof createNode>>;

describe('registration persistence (PostgreSQL integration)', () => {
  let database: EphemeralDatabase;
  let nodeA: Node;
  let nodeB: Node;
  const clock = new FakeClock(new Date());
  const delivery = new CapturingDelivery();
  const telemetry = new CapturingTelemetry();

  const query = async <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
    (await database.pool.query<T>(text, values)).rows;

  async function verifiedChallenge(node: Node, contact: string): Promise<string> {
    const { verificationId } = await node.request.execute({ channel: 'email', contact });
    await node.verify.execute({ verificationId, otp: delivery.lastOtp() });
    return verificationId;
  }

  async function incompleteAccount(node: Node, contact: string): Promise<string> {
    const verificationId = await verifiedChallenge(node, contact);
    const { registrationId } = await node.start.execute({ verificationId, password: PASSWORD });
    const { accountId } = await node.saveRequiredData.execute({
      registrationId,
      displayName: 'Ana',
      region: 'Recife - PE',
      usageIntents: ['friendship', 'explore_city'],
    });
    return accountId;
  }

  beforeAll(async () => {
    database = await createEphemeralDatabase(adminUrl);
    process.env.DATABASE_URL = database.url;
    process.env.DATABASE_SSL_MODE = 'disable';
    // Approved documents exist only in this disposable database (ADR-012).
    for (const [index, kind] of ['terms', 'privacy', 'community_rules'].entries()) {
      await query(
        `insert into terms_document (id, kind, version, locale, effective_at, content_digest, status)
         values ($1, $2, 'test', 'pt-BR', now(), '\\x00', 'approved')`,
        [DOCUMENT_IDS[index], kind],
      );
    }
    nodeA = await createNode(clock, delivery, telemetry);
    nodeB = await createNode(clock, delivery, telemetry);
  });

  afterAll(async () => {
    await nodeA?.module.close();
    await nodeB?.module.close();
    await database?.drop();
  });

  describe('migrations', () => {
    test('create exactly the approved tables, indexes and seed', async () => {
      const tables = await query<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
      );
      expect(tables.map((row) => row.table_name)).toEqual(REGISTRATION_TABLES);

      const indexes = (await query<{ indexname: string }>(`select indexname from pg_indexes where schemaname = 'public'`)).map(
        (row) => row.indexname,
      );
      expect(indexes).toEqual(
        expect.arrayContaining([
          'contact_verification_open_contact_unique',
          'registration_retained_contact_unique',
          'account_contact_holding_contact_unique',
          'account_status_updated_at_index',
          'registration_status_expires_at_index',
        ]),
      );

      const [interests] = await query<{ count: string }>(`select count(*)::text as count from interest where active`);
      expect(interests?.count).toBe('20');
    });

    test('are idempotent: re-running the ledger and the seed changes nothing', async () => {
      await database.migrate();
      await database.pool.query(readFileSync(join(process.cwd(), 'drizzle/0001_seed_interests.sql'), 'utf8'));

      const [interests] = await query<{ count: string }>(`select count(*)::text as count from interest`);
      const [ledger] = await query<{ count: string }>(`select count(*)::text as count from drizzle.__drizzle_migrations`);
      expect(interests?.count).toBe('20');
      expect(ledger?.count).toBe('3');
    });
  });

  describe('constraints', () => {
    test('reject WhatsApp challenges without consent and more than five failures', async () => {
      const insert = (channel: string, failedAttempts: number, consent: string | null) =>
        database.pool.query(
          `insert into contact_verification (id, purpose, channel, contact_hash, contact_ciphertext, otp_digest, expires_at,
             last_sent_at, delivery_idempotency_key, failed_attempts, whatsapp_consent_at)
           values (gen_random_uuid(), 'registration', $1, sha256(gen_random_uuid()::text::bytea), '\\x00', '\\x00', now(), now(),
             gen_random_uuid(), $2, $3)`,
          [channel, failedAttempts, consent],
        );

      await expect(insert('whatsapp', 0, null)).rejects.toMatchObject({ code: '23514' });
      await expect(insert('email', 6, null)).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('flow', () => {
    test('activates an account end to end without storing the contact in clear', async () => {
      const accountId = await incompleteAccount(nodeA, 'flow@example.test');

      await nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS });

      const [account] = await query<{ status: string; activated_at: Date | null; birth_date: string | null }>(
        `select status, activated_at, birth_date::text from account where id = $1`,
        [accountId],
      );
      expect(account).toMatchObject({ status: 'active', birth_date: '1990-05-10' });
      expect(account?.activated_at).not.toBeNull();
      const [registration] = await query<{ status: string; contact_hash: Buffer | null; password_hash: string | null }>(
        `select r.status, r.contact_hash, r.password_hash from registration r join account a on a.registration_id = r.id where a.id = $1`,
        [accountId],
      );
      expect(registration).toEqual({ status: 'converted', contact_hash: null, password_hash: null });
      const [counts] = await query<{ interests: string; acceptances: string; intents: string }>(
        `select (select count(*) from account_interest where account_id = $1)::text as interests,
                (select count(*) from terms_acceptance where account_id = $1)::text as acceptances,
                (select count(*) from profile_usage_intent where account_id = $1)::text as intents`,
        [accountId],
      );
      expect(counts).toEqual({ interests: '3', acceptances: '3', intents: '2' });

      const [leak] = await query<{ count: string }>(
        `select count(*)::text as count from (
           select contact_ciphertext as value from contact_verification
           union all select contact_ciphertext from account_contact
           union all select contact_hash from account_contact) values
         where position(convert_to('flow@example.test', 'UTF8') in value) > 0`,
      );
      expect(leak?.count).toBe('0');
      const [credential] = await query<{ password_hash: string }>(
        `select password_hash from account_credential where account_id = $1`,
        [accountId],
      );
      expect(credential?.password_hash).toStartWith('$argon2id$');
      expect(JSON.stringify(telemetry.events)).not.toContain('flow@example.test');
    });

    test('answers neutrally for a held contact, sends a recovery notice and still counts the attempt', async () => {
      await incompleteAccount(nodeA, 'held@example.test');
      const sentBefore = delivery.sent.length;

      const result = await nodeB.request.execute({ channel: 'email', contact: 'held@example.test' });

      const [challenge] = await query<{ count: string }>(`select count(*)::text as count from contact_verification where id = $1`, [
        result.verificationId,
      ]);
      expect(challenge?.count).toBe('0');
      expect(delivery.sent.slice(sentBefore)).toEqual([expect.objectContaining({ kind: 'recovery_notice' })]);
      const windows = await query<{ scope: string; request_count: number }>(
        `select scope, request_count from verification_rate_window order by request_count desc`,
      );
      expect(windows.every((row) => row.scope === 'contact')).toBe(true);
      expect(windows.some((row) => row.request_count >= 2)).toBe(true);
    });

    test('persists WhatsApp consent and rotates the OTP digest on resend', async () => {
      const consent = clock.now();
      const { verificationId } = await nodeA.request.execute({
        channel: 'whatsapp',
        contact: '+5581999990001',
        whatsappConsentAt: consent,
      });
      const [before] = await query<{ otp_digest: Buffer; whatsapp_consent_at: Date }>(
        `select otp_digest, whatsapp_consent_at from contact_verification where id = $1`,
        [verificationId],
      );
      expect(before?.whatsapp_consent_at).toEqual(consent);

      clock.advance(60_000);
      await nodeA.resend.execute({ verificationId });
      const [after] = await query<{ otp_digest: Buffer; resend_count: number }>(
        `select otp_digest, resend_count from contact_verification where id = $1`,
        [verificationId],
      );
      expect(after?.resend_count).toBe(1);
      expect(after?.otp_digest.equals(before?.otp_digest ?? Buffer.alloc(0))).toBe(false);
    });
  });

  describe('concurrency across two pools', () => {
    test('six concurrent wrong OTPs count exactly five failures and lock the challenge', async () => {
      const { verificationId } = await nodeA.request.execute({ channel: 'email', contact: 'otp-race@example.test' });

      const results = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          (index % 2 === 0 ? nodeA : nodeB).verify.execute({ verificationId, otp: 'wrong!' }),
        ),
      );

      expect(results.every((result) => !result.verified)).toBe(true);
      const [row] = await query<{ failed_attempts: number; locked_until: Date | null; status: string }>(
        `select failed_attempts, locked_until, status from contact_verification where id = $1`,
        [verificationId],
      );
      expect(row?.failed_attempts).toBe(5);
      expect(row?.locked_until).not.toBeNull();
      expect(row?.status).toBe('open');
    });

    test('two concurrent requests for a new contact keep a single open challenge, without leaking errors', async () => {
      const contact = 'contact-race@example.test';

      await Promise.all([
        nodeA.request.execute({ channel: 'email', contact }),
        nodeB.request.execute({ channel: 'email', contact }),
      ]);

      const [row] = await query<{ count: string }>(
        `select count(*)::text as count from contact_verification where status = 'open' and contact_hash = (
           select contact_hash from contact_verification order by created_at desc limit 1)`,
      );
      expect(row?.count).toBe('1');
    });

    test('concurrent activation succeeds exactly once', async () => {
      const accountId = await incompleteAccount(nodeA, 'activation-race@example.test');
      const input = { accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS, documentIds: DOCUMENT_IDS };

      const results = await Promise.allSettled([nodeA.complete.execute(input), nodeB.complete.execute(input)]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected')).toMatchObject({
        reason: expect.objectContaining({ code: 'ACCOUNT_CANNOT_BE_ACTIVATED' }),
      });
      const [counts] = await query<{ acceptances: string }>(
        `select count(*)::text as acceptances from terms_acceptance where account_id = $1`,
        [accountId],
      );
      expect(counts?.acceptances).toBe('3');
    });
  });

  describe('transactions and expiration', () => {
    test('a failure midway through activation leaves no partial effect', async () => {
      const accountId = await incompleteAccount(nodeA, 'rollback@example.test');
      await database.pool.query(`
        create function fail_acceptance() returns trigger language plpgsql as $$
        begin raise exception 'simulated failure'; end $$;
        create trigger fail_acceptance before insert on terms_acceptance
        for each row execute function fail_acceptance();`);
      try {
        await expect(
          nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS, documentIds: DOCUMENT_IDS }),
        ).rejects.toThrow();
      } finally {
        await database.pool.query(`drop trigger fail_acceptance on terms_acceptance; drop function fail_acceptance();`);
      }

      const [state] = await query<{ status: string; interests: string }>(
        `select status, (select count(*) from account_interest where account_id = $1)::text as interests
         from account where id = $1`,
        [accountId],
      );
      expect(state).toEqual({ status: 'account_incomplete', interests: '0' });
    });

    test('an overdue registration is expired lazily and its contact released', async () => {
      const verificationId = await verifiedChallenge(nodeA, 'lazy@example.test');
      const { registrationId } = await nodeA.start.execute({ verificationId, password: PASSWORD });
      clock.advance(DAY);

      const result = await nodeB.request.execute({ channel: 'email', contact: 'lazy@example.test' });

      const [registration] = await query<{ status: string; contact_hash: Buffer | null; key_version: number | null }>(
        `select status, contact_hash, key_version from registration where id = $1`,
        [registrationId],
      );
      expect(registration).toEqual({ status: 'expired', contact_hash: null, key_version: null });
      const [challenge] = await query<{ status: string }>(`select status from contact_verification where id = $1`, [
        result.verificationId,
      ]);
      expect(challenge?.status).toBe('open');
    });

    test('the batch expires stale incomplete accounts and nulls their personal data', async () => {
      const accountId = await incompleteAccount(nodeA, 'stale@example.test');
      clock.advance(15 * DAY);

      const result = await nodeA.expireStale.execute();

      expect(result.accounts).toBeGreaterThanOrEqual(1);
      const [row] = await query<Record<string, unknown>>(
        `select a.status, a.birth_date, c.contact_hash, c.holds_contact, k.password_hash, p.display_name, p.region,
                (select count(*) from profile_usage_intent where account_id = a.id)::text as intents
         from account a
         join account_contact c on c.account_id = a.id
         join account_credential k on k.account_id = a.id
         join profile p on p.account_id = a.id
         where a.id = $1`,
        [accountId],
      );
      expect(row).toEqual({
        status: 'expired',
        birth_date: null,
        contact_hash: null,
        holds_contact: false,
        password_hash: null,
        display_name: null,
        region: null,
        intents: '0',
      });
    });
  });
});
