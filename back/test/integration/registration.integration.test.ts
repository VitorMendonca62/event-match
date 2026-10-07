import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { CatalogModule } from '../../src/modules/catalog/catalog.module';
import { ProfilesModule } from '../../src/modules/profiles/profiles.module';
import { GetOwnProfile, UpdateOwnProfile } from '../../src/modules/profiles/application/use-cases/profile.use-cases';
import { CleanupProfileMedia, CreateProfilePhotoUpload, FinalizeProfilePhotoUpload, RemoveProfilePhoto } from '../../src/modules/profiles/application/use-cases/profile-media.use-cases';
import {
  PROFILE_IMAGE_STORE_PORT,
  PROFILE_MEDIA_REPOSITORY_PORT,
  type ProfileMediaRepositoryPort,
} from '../../src/modules/profiles/domain/ports/outbound/profile-media.ports';
import { FakeProfileImageStoreAdapter } from '../../src/modules/profiles/infrastructure/media/fake-profile-image-store.adapter';
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
import { UNIT_OF_WORK_PORT, type UnitOfWorkPort } from '../../src/shared/application/ports/unit-of-work.port';
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
  'activity_preference',
  // SDD-013 (identity-access): sessions and login attempts.
  'authenticated_session',
  'authentication_attempt',
  'contact_verification',
  'interest',
  'language',
  'profile',
  'profile_activity_preference',
  'profile_availability_slot',
  'profile_language',
  'profile_media_attempt',
  'profile_photo_asset',
  'profile_usage_intent',
  'registration',
  'registration_flow_session',
  'registration_idempotency',
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
    .overrideProvider(PROFILE_IMAGE_STORE_PORT)
    .useClass(FakeProfileImageStoreAdapter)
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
    getProfile: module.get(GetOwnProfile),
    updateProfile: module.get(UpdateOwnProfile),
    createPhotoUpload: module.get(CreateProfilePhotoUpload),
    finalizePhotoUpload: module.get(FinalizeProfilePhotoUpload),
    removePhoto: module.get(RemoveProfilePhoto),
    cleanupMedia: module.get(CleanupProfileMedia),
    mediaRepository: module.get<ProfileMediaRepositoryPort>(PROFILE_MEDIA_REPOSITORY_PORT),
    uow: module.get<UnitOfWorkPort>(UNIT_OF_WORK_PORT),
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
        `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status)
         values ($1, $2, 'test', 'pt-BR', now() - interval '1 hour', sha256(convert_to('# fixture', 'UTF8')), '# fixture', 'approved')`,
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
      const documents = await query<{ kind: string; version: string; locale: string; digest: string }>(
        `select kind, version, locale, encode(content_digest, 'hex') as digest
         from terms_document
         where version = '1.0.0' and locale = 'pt-BR'
         order by kind`,
      );
      expect(interests?.count).toBe('20');
      expect(documents).toEqual([
        {
          kind: 'community_rules',
          version: '1.0.0',
          locale: 'pt-BR',
          digest: '055385aa29006e1b18e019f88f22547ca383f09791f6ac2a2b549381455a8f5d',
        },
        {
          kind: 'privacy',
          version: '1.0.0',
          locale: 'pt-BR',
          digest: 'ece3b82d0ee35f8ac25df42272c0c1107fb02c4dc30ce6b6e7d8ef27037f09d5',
        },
        {
          kind: 'terms',
          version: '1.0.0',
          locale: 'pt-BR',
          digest: '451a84dc658d3cde409607e64a527ed2d20ab576224e58da3126b7f34c5c62d9',
        },
      ]);
    });

    test('are idempotent: re-running the ledger and the seed changes nothing', async () => {
      await database.migrate();
      await database.pool.query(readFileSync(join(process.cwd(), 'drizzle/0001_seed_interests.sql'), 'utf8'));

      const [interests] = await query<{ count: string }>(`select count(*)::text as count from interest`);
      const [ledger] = await query<{ count: string }>(`select count(*)::text as count from drizzle.__drizzle_migrations`);
      expect(interests?.count).toBe('20');
      expect(ledger?.count).toBe('11');
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
    test('two profile writes with the same revision commit exactly once', async () => {
      const accountId = await incompleteAccount(nodeA, 'profile-race@example.test');
      await nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS });
      const current = await nodeA.getProfile.execute(accountId);
      const common = { accountId, revision: current.revision, region: 'Recife - PE', usageIntents: ['friendship'] as const, interestIds: INTEREST_IDS.slice(0, 3), photoVisibility: 'private' as const, presentationVisibility: 'authenticated' as const, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languagesVisibility: 'authenticated' as const, activityPreferencesVisibility: 'authenticated' as const, availabilitySlots: ['fri_evening'] as const, preferredDistance: 'up_to_5km' as const };
      const first = { ...common, displayName: 'Ana Português', presentation: 'Primeira edição concorrente', languageCodes: ['pt'], activityPreferenceCodes: ['small_group', 'quiet_setting'] };
      const second = { ...common, displayName: 'Ana Libras', presentation: 'Segunda edição concorrente', languageCodes: ['bzs'], activityPreferenceCodes: ['outdoor'] };

      const results = await Promise.allSettled([nodeA.updateProfile.execute(first), nodeB.updateProfile.execute(second)]);

      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      expect(results.find(({ status }) => status === 'rejected')).toMatchObject({ reason: { code: 'PROFILE_REVISION_CONFLICT' } });
      const [row] = await query<{ revision: number; display_name: string; presentation: string }>(`select revision, display_name, presentation from profile where account_id = $1`, [accountId]);
      const languageRows = await query<{ language_code: string }>(`select language_code from profile_language where account_id = $1`, [accountId]);
      const preferenceRows = await query<{ preference_code: string }>(`select preference_code from profile_activity_preference where account_id = $1 order by preference_code`, [accountId]);
      const availabilityRows = await query<{ weekday: string; period: string }>(`select weekday, period from profile_availability_slot where account_id = $1 order by weekday, period`, [accountId]);
      const [distanceRow] = await query<{ preferred_distance: string | null }>(`select preferred_distance from profile where account_id = $1`, [accountId]);
      expect(row?.revision).toBe(current.revision + 1);
      expect(availabilityRows).toEqual([{ weekday: 'fri', period: 'evening' }]);
      expect(distanceRow).toEqual({ preferred_distance: 'up_to_5km' });
      if (row?.display_name === first.displayName) {
        expect(row.presentation).toBe(first.presentation);
        expect(languageRows).toEqual([{ language_code: 'pt' }]);
        expect(preferenceRows).toEqual([{ preference_code: 'quiet_setting' }, { preference_code: 'small_group' }]);
      } else {
        expect(row).toMatchObject({ display_name: second.displayName, presentation: second.presentation });
        expect(languageRows).toEqual([{ language_code: 'bzs' }]);
        expect(preferenceRows).toEqual([{ preference_code: 'outdoor' }]);
      }
    });

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

  describe('profile media lifecycle', () => {
    test('persists pending → active → delete_pending and cleans it idempotently', async () => {
      const accountId = await incompleteAccount(nodeA, 'profile-media@example.test');
      await nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS });
      const initial = await nodeA.getProfile.execute(accountId);
      const grant = await nodeA.createPhotoUpload.execute({ accountId, originSubject: 'integration-origin', revision: initial.revision });

      const [pending] = await query<{ state: string }>(`select state from profile_photo_asset where id = $1`, [grant.uploadId]);
      expect(pending?.state).toBe('pending');

      await nodeA.finalizePhotoUpload.execute({ accountId, uploadId: grant.uploadId, revision: initial.revision, providerResponse: { public_id: grant.publicId, signature: 'fixture-response-signature' } });
      const activeProfile = await nodeA.getProfile.execute(accountId);
      expect(activeProfile.revision).toBe(initial.revision + 1);
      const [active] = await query<{ state: string; version: number }>(`select state, version from profile_photo_asset where id = $1`, [grant.uploadId]);
      expect(active).toEqual({ state: 'active', version: 1 });

      await nodeA.removePhoto.execute({ accountId, revision: activeProfile.revision });
      const [deleting] = await query<{ state: string }>(`select state from profile_photo_asset where id = $1`, [grant.uploadId]);
      expect(['delete_pending', undefined]).toContain(deleting?.state);
      await nodeA.cleanupMedia.execute(20);
      await nodeA.cleanupMedia.execute(20);
      const [remaining] = await query<{ count: string }>(`select count(*)::text as count from profile_photo_asset where id = $1`, [grant.uploadId]);
      expect(remaining?.count).toBe('0');
    });

    test('persists the account rate limit across use-case calls', async () => {
      const accountId = await incompleteAccount(nodeA, 'profile-limit@example.test');
      await nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS });
      const current = await nodeA.getProfile.execute(accountId);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await nodeA.createPhotoUpload.execute({ accountId, originSubject: `origin-${attempt}`, revision: current.revision });
      }
      await expect(nodeB.createPhotoUpload.execute({ accountId, originSubject: 'origin-last', revision: current.revision })).rejects.toMatchObject({ code: 'MEDIA_RATE_LIMITED' });
    });

    test('enforces the exact origin limit across distinct account subjects', async () => {
      const originSubject = Buffer.alloc(32, 91);
      const attempts = await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
          nodeA.uow.execute((context) => nodeA.mediaRepository.consumeLimit(context, {
            accountSubject: Buffer.alloc(32, index + 1),
            originSubject,
            now: new Date(),
            accountLimit: 10,
            originLimit: 30,
          })),
        ),
      );
      expect(attempts.every((result) => result === 'allowed')).toBeTrue();
      await expect(nodeB.uow.execute((context) => nodeB.mediaRepository.consumeLimit(context, {
        accountSubject: Buffer.alloc(32, 99),
        originSubject,
        now: new Date(),
        accountLimit: 10,
        originLimit: 30,
      }))).resolves.toBe('origin_limited');
    });

    test('activates a pending upload exactly once under concurrent finalization', async () => {
      const accountId = await incompleteAccount(nodeA, 'profile-media-race@example.test');
      await nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS });
      const initial = await nodeA.getProfile.execute(accountId);
      const grant = await nodeA.createPhotoUpload.execute({ accountId, originSubject: 'race-origin', revision: initial.revision });
      const input = { accountId, uploadId: grant.uploadId, revision: initial.revision, providerResponse: { public_id: grant.publicId, signature: 'fixture-response-signature' } };

      const settled = await Promise.allSettled([
        nodeA.finalizePhotoUpload.execute(input),
        nodeB.finalizePhotoUpload.execute(input),
      ]);

      expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      const rejected = settled.find(({ status }) => status === 'rejected');
      expect(['PROFILE_NOT_FOUND', 'PROFILE_REVISION_CONFLICT', 'PHOTO_UPLOAD_EXPIRED']).toContain((rejected as PromiseRejectedResult).reason.code);
      const [state] = await query<{ active: string; revision: number }>(
        `select (select count(*) from profile_photo_asset where account_id = $1 and state = 'active')::text as active,
                (select revision from profile where account_id = $1) as revision`,
        [accountId],
      );
      expect(state).toEqual({ active: '1', revision: initial.revision + 1 });
    });

    test('binds pending assets to their owner and rejects expired grants', async () => {
      const [ownerId, strangerId] = await Promise.all([
        incompleteAccount(nodeA, 'profile-owner@example.test'),
        incompleteAccount(nodeB, 'profile-stranger@example.test'),
      ]);
      await Promise.all([
        nodeA.complete.execute({ accountId: ownerId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS }),
        nodeB.complete.execute({ accountId: strangerId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS }),
      ]);
      const [owner, stranger] = await Promise.all([nodeA.getProfile.execute(ownerId), nodeB.getProfile.execute(strangerId)]);
      const grant = await nodeA.createPhotoUpload.execute({ accountId: ownerId, originSubject: 'owner-origin', revision: owner.revision });

      await expect(nodeB.finalizePhotoUpload.execute({
        accountId: strangerId,
        uploadId: grant.uploadId,
        revision: stranger.revision,
        providerResponse: { public_id: grant.publicId, signature: 'fixture-response-signature' },
      })).rejects.toMatchObject({ code: 'PROFILE_NOT_FOUND' });
      await expect(nodeB.removePhoto.execute({ accountId: strangerId, revision: stranger.revision })).resolves.toEqual({ removed: false });
      await query(`update profile_photo_asset set upload_expires_at = now() - interval '1 second' where id = $1`, [grant.uploadId]);
      await expect(nodeA.finalizePhotoUpload.execute({
        accountId: ownerId,
        uploadId: grant.uploadId,
        revision: owner.revision,
        providerResponse: { public_id: grant.publicId, signature: 'fixture-response-signature' },
      })).rejects.toMatchObject({ code: 'PHOTO_UPLOAD_EXPIRED' });
    });
  });

  describe('transactions and expiration', () => {
    test('a failure while replacing interests rolls the whole profile update back', async () => {
      const accountId = await incompleteAccount(nodeA, 'profile-rollback@example.test');
      await nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS });
      const initial = await nodeA.getProfile.execute(accountId);
      await nodeA.updateProfile.execute({ accountId, revision: initial.revision, displayName: initial.displayName, region: initial.region, usageIntents: initial.usageIntents, interestIds: initial.interests.map(({ id }) => id), presentation: initial.presentation, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: ['pt'], languagesVisibility: 'private', activityPreferenceCodes: ['indoor'], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null });
      const before = await nodeA.getProfile.execute(accountId);
      await database.pool.query(`
        create function fail_profile_interest() returns trigger language plpgsql as $$
        begin raise exception 'simulated profile interest failure'; end $$;
        create trigger fail_profile_interest before insert on account_interest
        for each row execute function fail_profile_interest();`);
      try {
        await expect(nodeA.updateProfile.execute({ accountId, revision: before.revision, displayName: 'Não deve persistir', region: before.region, usageIntents: ['explore_city'], interestIds: INTEREST_IDS.slice(1, 4), presentation: 'Também não persiste', photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: ['bzs'], languagesVisibility: 'private', activityPreferenceCodes: ['outdoor'], activityPreferencesVisibility: 'authenticated', availabilitySlots: ['sat_evening'], preferredDistance: 'up_to_10km' })).rejects.toThrow();
      } finally {
        await database.pool.query(`drop trigger fail_profile_interest on account_interest; drop function fail_profile_interest();`);
      }
      const after = await nodeA.getProfile.execute(accountId);
      expect(after).toMatchObject({ revision: before.revision, displayName: before.displayName, presentation: before.presentation, usageIntents: before.usageIntents });
      expect(after.interests.map(({ id }) => id).sort()).toEqual(before.interests.map(({ id }) => id).sort());
      expect(after.languages.map(({ code }) => code)).toEqual(['pt']);
      expect(after.activityPreferences.map(({ code }) => code)).toEqual(['indoor']);
      expect(after.activityPreferencesVisibility).toBe('private');
      expect(after.availabilitySlots).toEqual(before.availabilitySlots);
      expect(after.preferredDistance).toBe(before.preferredDistance);
    });

    test('a deactivated preference stays readable, is preservable and cannot be re-added after removal', async () => {
      const accountId = await incompleteAccount(nodeA, 'profile-preference-deactivated@example.test');
      await nodeA.complete.execute({ accountId, birthDate: '1990-05-10', interestIds: INTEREST_IDS.slice(0, 3), documentIds: DOCUMENT_IDS });
      const initial = await nodeA.getProfile.execute(accountId);
      const base = { accountId, displayName: initial.displayName, region: initial.region, usageIntents: initial.usageIntents, interestIds: initial.interests.map(({ id }) => id), presentation: initial.presentation, photoVisibility: 'private' as const, presentationVisibility: 'private' as const, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languageCodes: [], languagesVisibility: 'private' as const, activityPreferencesVisibility: 'authenticated' as const, availabilitySlots: [], preferredDistance: null };
      await nodeA.updateProfile.execute({ ...base, revision: initial.revision, activityPreferenceCodes: ['medium_group', 'outdoor'] });
      await query(`update activity_preference set active = false where code = 'medium_group'`);
      try {
        const read = await nodeA.getProfile.execute(accountId);
        expect(read.activityPreferences).toEqual([{ code: 'outdoor', label: 'Ao ar livre', active: true }, { code: 'medium_group', label: 'Grupo médio', active: false }]);
        const kept = await nodeA.updateProfile.execute({ ...base, revision: read.revision, activityPreferenceCodes: ['medium_group'] });
        expect(kept.activityPreferences).toEqual([{ code: 'medium_group', label: 'Grupo médio', active: false }]);
        const removed = await nodeA.updateProfile.execute({ ...base, revision: kept.revision, activityPreferenceCodes: [] });
        await expect(nodeA.updateProfile.execute({ ...base, revision: removed.revision, activityPreferenceCodes: ['medium_group'] }))
          .rejects.toMatchObject({ code: 'INACTIVE_ACTIVITY_PREFERENCE', reason: 'inactive_activity_preference' });
      } finally {
        await query(`update activity_preference set active = true where code = 'medium_group'`);
      }
    });

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
      await query(`update profile set pronoun_selection = 'ela_dela', pronouns_visibility = 'authenticated', profession = 'Produtora', profession_visibility = 'authenticated', languages_visibility = 'authenticated' where account_id = $1`, [accountId]);
      await query(`update profile set preferred_distance = 'up_to_5km' where account_id = $1`, [accountId]);
      await query(`insert into profile_language (account_id, language_code, selected_at) values ($1, 'pt', now())`, [accountId]);
      await query(`update profile set activity_preferences_visibility = 'authenticated' where account_id = $1`, [accountId]);
      await query(`insert into profile_activity_preference (account_id, preference_code, selected_at) values ($1, 'small_group', now())`, [accountId]);
      await query(`insert into profile_availability_slot (account_id, weekday, period, selected_at) values ($1, 'fri', 'evening', now())`, [accountId]);
      clock.advance(15 * DAY);

      const result = await nodeA.expireStale.execute();

      expect(result.accounts).toBeGreaterThanOrEqual(1);
      const [row] = await query<Record<string, unknown>>(
        `select a.status, a.birth_date, c.contact_hash, c.holds_contact, k.password_hash, p.display_name, p.region,
                p.pronoun_selection, p.pronouns_visibility, p.profession, p.profession_visibility, p.languages_visibility, p.activity_preferences_visibility, p.preferred_distance,
                (select count(*) from profile_usage_intent where account_id = a.id)::text as intents,
                (select count(*) from profile_language where account_id = a.id)::text as languages,
                (select count(*) from profile_activity_preference where account_id = a.id)::text as preferences,
                (select count(*) from profile_availability_slot where account_id = a.id)::text as availability
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
        pronoun_selection: null,
        pronouns_visibility: 'private',
        profession: null,
        profession_visibility: 'private',
        languages_visibility: 'private',
        activity_preferences_visibility: 'private',
        preferred_distance: null,
        intents: '0',
        languages: '0',
        preferences: '0',
        availability: '0',
      });
    });
  });
});
