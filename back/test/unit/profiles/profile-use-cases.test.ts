import { describe, expect, mock, test } from 'bun:test';
import { Logger } from '@nestjs/common';
import { GetOwnProfile, UpdateOwnProfile } from '../../../src/modules/profiles/application/use-cases/profile.use-cases';
import { CleanupProfileMedia, CreateProfilePhotoUpload, FinalizeProfilePhotoUpload, RemoveProfilePhoto } from '../../../src/modules/profiles/application/use-cases/profile-media.use-cases';
import { ProfileError } from '../../../src/modules/profiles/domain/errors/profile.error';
import { FakeProfileImageStoreAdapter } from '../../../src/modules/profiles/infrastructure/media/fake-profile-image-store.adapter';
import { LoggerProfileTelemetryAdapter } from '../../../src/modules/profiles/infrastructure/observability/logger-profile-telemetry.adapter';
import type { Profile } from '../../../src/modules/profiles/domain/entities/profile';
import type { ProfileEvent, ProfileTelemetryPort } from '../../../src/modules/profiles/domain/ports/outbound/profile-telemetry.port';

const context = {};
const uow = { execute: async <T>(work: (value: object) => Promise<T>) => work(context) };
const interests = [1, 2, 3].map((number) => ({ id: String(number), slug: `interest-${number}`, label: `Interest ${number}` }));
const state = { accountId: 'account', revision: 1, displayName: 'Ana', location: { ufCode: 'PE' as const, municipalityCode: '2611606', municipalityName: 'Recife' }, usageIntents: ['friendship'] as const, interests, presentation: null, photoVisibility: 'private' as const, presentationVisibility: 'private' as const, photo: null, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languageCodes: [] as readonly string[], languagesVisibility: 'private' as const, activityPreferenceCodes: [] as readonly string[], activityPreferencesVisibility: 'private' as const, availabilitySlots: [], preferredDistance: null, socialLinks: [] };
const catalog = { listActive: mock(async () => interests), findActiveByIds: mock(async () => interests) };
const languages = { listActive: mock(async () => [{ code: 'pt', label: 'Português', active: true }]), findByCodes: mock(async (_context: object, codes: readonly string[]) => codes.map((code) => ({ code, label: code === 'pt' ? 'Português' : code, active: true }))) };
const preferences = { listActive: mock(async () => []), findByCodes: mock(async (_context: object, codes: readonly string[]) => codes.map((code) => ({ code, label: code, active: true }))) };
const municipalities = { searchActive: mock(async () => []), findByCodeAndUf: mock(async () => ({ ufCode: 'PE' as const, municipalityCode: '2611606', municipalityName: 'Recife', active: true })) };
const telemetryEvents: ProfileEvent[] = [];
const telemetry: ProfileTelemetryPort = { record: (event) => telemetryEvents.push(event) };
const subjects = { digest: mock(() => 'v1.subject') };
const imageStore = new FakeProfileImageStoreAdapter();
const mediaPolicy = { enabled: true, uploadTtlMs: 300_000, accountLimit: 10, originLimit: 30 };

describe('profile application use cases', () => {
  test('read hydrates the catalog, signs the active photo and records only an allowlisted event', async () => {
    telemetryEvents.length = 0;
    const profiles = { findOwn: mock(async () => state), updateIfRevision: mock(async () => 'updated' as const) };
    const media = { findActive: mock(async () => ({ id: 'asset', publicId: 'profiles/photo', version: 1 })) };
    const result = await new GetOwnProfile(uow, profiles, subjects, catalog, languages, preferences, media as never, imageStore, telemetry, mediaPolicy).execute('account');
    expect(result.photo?.deliveryUrl).toContain('media.example.test');
    expect(Object.keys(result.photo ?? {}).sort()).toEqual(['deliveryUrl', 'height', 'width']);
    expect(telemetryEvents).toHaveLength(1); expect(telemetryEvents[0]).toMatchObject({ name: 'profile.read', outcome: 'success', status: 200 });
    expect(JSON.stringify(telemetryEvents[0])).not.toContain('account');
  });

  test('two updates with one revision yield one success and one observable conflict', async () => {
    telemetryEvents.length = 0; let revision = 1;
    const profiles = {
      findOwn: mock(async () => ({ ...state, revision })),
      updateIfRevision: mock(async (_context: object, _profile: unknown, expected: number) => { if (revision !== expected) return 'conflict' as const; revision += 1; return 'updated' as const; }),
    };
    const media = { findActive: mock(async () => null) };
    const useCase = new UpdateOwnProfile(uow, profiles, catalog, languages, preferences, municipalities, media as never, imageStore, telemetry, mediaPolicy);
    const input = { accountId: 'account', revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'] as const, interestIds: ['1', '2', '3'], presentation: 'Atividades em grupo', photoVisibility: 'private' as const, presentationVisibility: 'authenticated' as const, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languageCodes: [], languagesVisibility: 'private' as const, activityPreferenceCodes: [] as readonly string[], activityPreferencesVisibility: 'private' as const, availabilitySlots: [], preferredDistance: null, socialLinks: [] };
    const settled = await Promise.allSettled([useCase.execute(input), useCase.execute(input)]);
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({ reason: { code: 'PROFILE_REVISION_CONFLICT' } });
    expect(telemetryEvents.some(({ name, outcome }) => name === 'profile.conflict' && outcome === 'conflict')).toBeTrue();
  });

  test('keeps an inactive historical municipality but refuses selecting it as a new location', async () => {
    const profiles = { findOwn: mock(async () => state), updateIfRevision: mock(async () => 'updated' as const) };
    const inactiveMunicipality = {
      searchActive: mock(async () => []),
      findByCodeAndUf: mock(async (_context: object, input: { ufCode: string; municipalityCode: string }) => ({
        ufCode: input.ufCode as 'PE' | 'DF', municipalityCode: input.municipalityCode,
        municipalityName: input.ufCode === 'DF' ? 'Brasília' : 'Recife', active: false,
      })),
    };
    const media = { findActive: mock(async () => null) };
    const useCase = new UpdateOwnProfile(uow, profiles, catalog, languages, preferences, inactiveMunicipality, media as never, imageStore, telemetry, mediaPolicy);
    const input = { accountId: 'account', revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'] as const, interestIds: ['1', '2', '3'], presentation: null, photoVisibility: 'private' as const, presentationVisibility: 'private' as const, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languageCodes: [], languagesVisibility: 'private' as const, activityPreferenceCodes: [] as readonly string[], activityPreferencesVisibility: 'private' as const, availabilitySlots: [], preferredDistance: null, socialLinks: [] };

    await expect(useCase.execute(input)).resolves.toMatchObject({ location: { municipalityCode: '2611606' } });
    await expect(useCase.execute({ ...input, ufCode: 'DF', municipalityCode: '5300108' })).rejects.toMatchObject({ code: 'INVALID_LOCATION', reason: 'invalid_location' });
    expect(profiles.updateIfRevision).toHaveBeenCalledTimes(1);
  });

  test('updates availability atomically and returns its canonical private view', async () => {
    const profiles = {
      findOwn: mock(async () => state),
      updateIfRevision: mock(async (_context: object, aggregate: { snapshot: () => ReturnType<Profile['snapshot']> }, expectedRevision: number) => {
        void expectedRevision;
        expect(aggregate.snapshot().availabilitySlots).toEqual(['mon_morning', 'fri_early_hours']);
        expect(aggregate.snapshot().preferredDistance).toBe('up_to_5km');
        return 'updated' as const;
      }),
    };
    const media = { findActive: mock(async () => null) };
    const result = await new UpdateOwnProfile(uow, profiles, catalog, languages, preferences, municipalities, media as never, imageStore, telemetry, mediaPolicy).execute({
      accountId: 'account', revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'], interestIds: ['1', '2', '3'],
      presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null,
      pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private',
      activityPreferenceCodes: [], activityPreferencesVisibility: 'private', availabilitySlots: ['fri_early_hours', 'mon_morning'], preferredDistance: 'up_to_5km', socialLinks: [],
    });
    expect(result.availabilitySlots).toEqual(['mon_morning', 'fri_early_hours']);
    expect(result.preferredDistance).toBe('up_to_5km');
  });

  test('updates social links atomically, canonicalizes identifiers and derives trusted URLs', async () => {
    const profiles = {
      findOwn: mock(async () => state),
      updateIfRevision: mock(async (_context: object, aggregate: { snapshot: () => ReturnType<Profile['snapshot']> }) => {
        expect(aggregate.snapshot().socialLinks).toEqual([
          { id: expect.any(String), provider: 'instagram', canonicalIdentifier: 'ana.exemplo', position: 1, visibility: 'private' },
          { id: expect.any(String), provider: 'linkedin', canonicalIdentifier: 'ana-silva', position: 2, visibility: 'authenticated' },
        ]);
        return 'updated' as const;
      }),
    };
    const media = { findActive: mock(async () => null) };
    const result = await new UpdateOwnProfile(uow, profiles, catalog, languages, preferences, municipalities, media as never, imageStore, telemetry, mediaPolicy).execute({
      accountId: 'account', revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'], interestIds: ['1', '2', '3'],
      presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null,
      pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private',
      activityPreferenceCodes: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null,
      socialLinks: [
        { provider: 'instagram', identifierOrUrl: '@Ana.Exemplo', position: 1, visibility: 'private' },
        { provider: 'linkedin', identifierOrUrl: 'https://www.linkedin.com/in/Ana-Silva/', position: 2, visibility: 'authenticated' },
      ],
    });
    expect(result.socialLinks).toEqual([
      { id: expect.any(String), provider: 'instagram', identifier: 'ana.exemplo', position: 1, visibility: 'private', url: 'https://www.instagram.com/ana.exemplo' },
      { id: expect.any(String), provider: 'linkedin', identifier: 'ana-silva', position: 2, visibility: 'authenticated', url: 'https://www.linkedin.com/in/ana-silva' },
    ]);
  });

  test('media rollback keeps persisted photo completion without touching the provider', async () => {
    const profiles = {
      findOwn: mock(async () => ({
        ...state,
        presentation: 'Atividades em grupo',
        photo: { deliveryUrl: '', width: 512 as const, height: 512 as const },
      })),
      updateIfRevision: mock(async () => 'updated' as const),
    };
    const media = { findActive: mock(async () => { throw new Error('must stay disabled'); }) };
    const result = await new GetOwnProfile(uow, profiles, subjects, catalog, languages, preferences, media as never, imageStore, telemetry, { ...mediaPolicy, enabled: false }).execute('account');
    expect(result.presentation).toBe('Atividades em grupo');
    expect(result.photo).toBeNull();
    expect(result.completion).toEqual({ complete: true, completedCount: 6, totalCount: 6, missing: [] });
    expect(media.findActive).not.toHaveBeenCalled();
  });

  test('text update keeps persisted photo completion while media delivery is disabled', async () => {
    const persisted = {
      ...state,
      presentation: 'Atividades em grupo',
      photo: { deliveryUrl: '', width: 512 as const, height: 512 as const },
    };
    const profiles = {
      findOwn: mock(async () => persisted),
      updateIfRevision: mock(async () => 'updated' as const),
    };
    const media = { findActive: mock(async () => { throw new Error('must stay disabled'); }) };
    const useCase = new UpdateOwnProfile(
      uow,
      profiles,
      catalog,
      languages,
      preferences,
      municipalities,
      media as never,
      imageStore,
      telemetry,
      { ...mediaPolicy, enabled: false },
    );

    const result = await useCase.execute({
      accountId: 'account',
      revision: 1,
      displayName: 'Ana Maria',
      ufCode: 'PE',
      municipalityCode: '2611606',
      usageIntents: ['friendship'],
      interestIds: ['1', '2', '3'],
      presentation: 'Atividades em grupo',
      photoVisibility: 'private',
      presentationVisibility: 'private',
      pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null,
      professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private',
      activityPreferenceCodes: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null, socialLinks: [],
    });

    expect(result.photo).toBeNull();
    expect(result.completion).toEqual({ complete: true, completedCount: 6, totalCount: 6, missing: [] });
    expect(media.findActive).not.toHaveBeenCalled();
  });

  test('preserves a selected inactive language but refuses adding it after removal', async () => {
    const inactive = { code: 'eo', label: 'Esperanto', active: false };
    const profiles = { findOwn: mock(async () => ({ ...state, languageCodes: ['eo'] })), updateIfRevision: mock(async () => 'updated' as const) };
    const inactiveCatalog = { listActive: mock(async () => []), findByCodes: mock(async () => [inactive]) };
    const media = { findActive: mock(async () => null) };
    const useCase = new UpdateOwnProfile(uow, profiles, catalog, inactiveCatalog, preferences, municipalities, media as never, imageStore, telemetry, mediaPolicy);
    const input = { accountId: 'account', revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'] as const, interestIds: ['1', '2', '3'], presentation: null, photoVisibility: 'private' as const, presentationVisibility: 'private' as const, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languageCodes: ['eo'], languagesVisibility: 'private' as const, activityPreferenceCodes: [] as readonly string[], activityPreferencesVisibility: 'private' as const, availabilitySlots: [], preferredDistance: null, socialLinks: [] };
    await expect(useCase.execute(input)).resolves.toMatchObject({ languages: [inactive] });
    profiles.findOwn = mock(async () => ({ ...state, languageCodes: [] }));
    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'INACTIVE_LANGUAGE', reason: 'inactive_language' });
  });

  describe('language selection limits (ADR-043)', () => {
    const CODES = ['pt', 'en', 'es', 'bzs', 'fr', 'it'];
    const catalogOf = (known: readonly string[]) => ({
      listActive: mock(async () => []),
      findByCodes: mock(async (_context: object, codes: readonly string[]) => codes.filter((code) => known.includes(code)).map((code) => ({ code, label: code, active: true }))),
    });
    const inputWith = (languageCodes: readonly string[]) => ({ accountId: 'account', revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'] as const, interestIds: ['1', '2', '3'], presentation: null, photoVisibility: 'private' as const, presentationVisibility: 'private' as const, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languageCodes, languagesVisibility: 'private' as const, activityPreferenceCodes: [] as readonly string[], activityPreferencesVisibility: 'private' as const, availabilitySlots: [], preferredDistance: null, socialLinks: [] });
    const setup = (known: readonly string[] = CODES) => {
      const profiles = { findOwn: mock(async () => state), updateIfRevision: mock(async () => 'updated' as const) };
      const useCase = new UpdateOwnProfile(uow, profiles, catalog, catalogOf(known), preferences, municipalities, { findActive: mock(async () => null) } as never, imageStore, telemetry, mediaPolicy);
      return { profiles, useCase };
    };

    test('accepts zero and five languages, keeping the chosen order', async () => {
      const { useCase } = setup();
      await expect(useCase.execute(inputWith([]))).resolves.toMatchObject({ languages: [] });
      const five = ['bzs', 'pt', 'en', 'es', 'fr'];
      const result = await useCase.execute(inputWith(five));
      expect(result.languages.map(({ code }) => code)).toEqual(five);
    });

    test('rejects six languages and duplicates without writing anything', async () => {
      const { profiles, useCase } = setup();
      await expect(useCase.execute(inputWith(CODES))).rejects.toMatchObject({ code: 'INVALID_PROFILE_CONTENT' });
      await expect(useCase.execute(inputWith(['pt', 'pt']))).rejects.toMatchObject({ code: 'INVALID_PROFILE_CONTENT' });
      expect(profiles.updateIfRevision).not.toHaveBeenCalled();
    });

    test('rejects an unknown language with an allowlisted reason and no partial write', async () => {
      const { profiles, useCase } = setup(['pt']);
      await expect(useCase.execute(inputWith(['pt', 'xx']))).rejects.toMatchObject({ code: 'UNKNOWN_LANGUAGE', reason: 'unknown_language' });
      expect(profiles.updateIfRevision).not.toHaveBeenCalled();
    });
  });

  describe('activity preferences (ADR-044)', () => {
    const ORDER = ['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group', 'medium_group'];
    const preferenceCatalog = (inactive: readonly string[] = []) => ({
      listActive: mock(async () => []),
      findByCodes: mock(async (_context: object, codes: readonly string[]) => ORDER
        .filter((code) => codes.includes(code))
        .map((code) => ({ code, label: `Rótulo ${code}`, active: !inactive.includes(code) }))),
    });
    const inputWith = (activityPreferenceCodes: readonly string[], activityPreferencesVisibility: 'private' | 'authenticated' = 'private') => ({ accountId: 'account', revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'] as const, interestIds: ['1', '2', '3'], presentation: null, photoVisibility: 'private' as const, presentationVisibility: 'private' as const, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const, profession: null, professionVisibility: 'private' as const, languageCodes: [] as readonly string[], languagesVisibility: 'private' as const, activityPreferenceCodes, activityPreferencesVisibility, availabilitySlots: [], preferredDistance: null, socialLinks: [] });
    const setup = (persistedCodes: readonly string[] = [], inactive: readonly string[] = []) => {
      const profiles = { findOwn: mock(async () => ({ ...state, activityPreferenceCodes: persistedCodes })), updateIfRevision: mock(async () => 'updated' as const) };
      const useCase = new UpdateOwnProfile(uow, profiles, catalog, languages, preferenceCatalog(inactive), municipalities, { findActive: mock(async () => null) } as never, imageStore, telemetry, mediaPolicy);
      return { profiles, useCase };
    };

    test('accepts zero and five, ordering by the catalog instead of the payload', async () => {
      const { useCase } = setup();
      await expect(useCase.execute(inputWith([]))).resolves.toMatchObject({ activityPreferences: [], activityPreferencesVisibility: 'private' });
      const result = await useCase.execute(inputWith(['small_group', 'outdoor', 'lively_setting', 'indoor', 'quiet_setting'], 'authenticated'));
      expect(result.activityPreferences.map(({ code }) => code)).toEqual(['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group']);
      expect(result.activityPreferencesVisibility).toBe('authenticated');
    });

    test('rejects six, duplicates and public visibility without writing', async () => {
      const { profiles, useCase } = setup();
      await expect(useCase.execute(inputWith(ORDER))).rejects.toMatchObject({ code: 'INVALID_PROFILE_CONTENT' });
      await expect(useCase.execute(inputWith(['outdoor', 'outdoor']))).rejects.toMatchObject({ code: 'INVALID_PROFILE_CONTENT' });
      await expect(useCase.execute({ ...inputWith(['outdoor']), activityPreferencesVisibility: 'public' as never })).rejects.toMatchObject({ code: 'INVALID_PROFILE_CONTENT' });
      expect(profiles.updateIfRevision).not.toHaveBeenCalled();
    });

    test('rejects an unknown preference with an allowlisted reason', async () => {
      const { profiles, useCase } = setup();
      await expect(useCase.execute(inputWith(['outdoor', 'rooftop_party']))).rejects.toMatchObject({ code: 'UNKNOWN_ACTIVITY_PREFERENCE', reason: 'unknown_activity_preference' });
      expect(profiles.updateIfRevision).not.toHaveBeenCalled();
    });

    test('preserves a selected inactive preference but refuses adding it again', async () => {
      const kept = setup(['indoor'], ['indoor']);
      await expect(kept.useCase.execute(inputWith(['indoor', 'outdoor']))).resolves.toMatchObject({
        activityPreferences: [{ code: 'outdoor', active: true }, { code: 'indoor', active: false }],
      });
      const removed = setup([], ['indoor']);
      await expect(removed.useCase.execute(inputWith(['indoor']))).rejects.toMatchObject({ code: 'INACTIVE_ACTIVITY_PREFERENCE', reason: 'inactive_activity_preference' });
      expect(removed.profiles.updateIfRevision).not.toHaveBeenCalled();
    });

    test('changing preferences keeps interests and completion untouched', async () => {
      const { useCase } = setup();
      const before = await useCase.execute(inputWith([]));
      const after = await useCase.execute(inputWith(['small_group', 'quiet_setting'], 'authenticated'));
      expect(after.interests).toEqual(before.interests);
      expect(after.completion).toEqual(before.completion);
    });

    test('telemetry never carries preference codes or labels', async () => {
      telemetryEvents.length = 0;
      const { useCase } = setup();
      await useCase.execute(inputWith(['small_group']));
      await useCase.execute(inputWith(['rooftop_party'])).catch(() => undefined);
      const serialized = JSON.stringify(telemetryEvents);
      expect(serialized).not.toContain('small_group');
      expect(serialized).not.toContain('rooftop_party');
      expect(serialized).not.toContain('Rótulo');
    });
  });
});

describe('profile media use cases', () => {
  const profileRepository = { findOwn: mock(async () => state), updateIfRevision: mock(async () => 'updated' as const) };
  const mediaBase = {
    consumeLimit: mock(async () => 'allowed' as const), createPending: mock(async () => undefined),
    findPending: mock(async () => ({ id: 'upload', accountId: 'account', publicId: 'profiles/photo', expiresAt: new Date(Date.now() + 60_000) })),
    findActive: mock(async () => null), activate: mock(async () => 'activated' as const), removeActive: mock(async () => 'marked' as const),
    listCleanup: mock(async () => [] as { id: string; publicId: string }[]), cleanupSucceeded: mock(async () => undefined), cleanupFailed: mock(async () => undefined),
  };
  const mediaSubjects = { digest: mock(() => Buffer.alloc(32, 1)) };
  const opportunisticCleanup = { execute: mock(async () => ({ processed: 0, failed: 0 })) };

  test('rate limits before creating a pending asset and records the scope-free refusal', async () => {
    telemetryEvents.length = 0; const media = { ...mediaBase, consumeLimit: mock(async () => 'origin_limited' as const) };
    const useCase = new CreateProfilePhotoUpload(uow, media, imageStore, mediaSubjects, mediaPolicy, profileRepository, telemetry, opportunisticCleanup as never);
    await expect(useCase.execute({ accountId: 'account', originSubject: 'opaque', revision: 1 })).rejects.toMatchObject({ code: 'MEDIA_RATE_LIMITED' });
    expect(media.createPending).not.toHaveBeenCalled(); expect(telemetryEvents[0]).toMatchObject({ name: 'profile.photo.grant', outcome: 'rate_limited', provider: 'fake' });
  });

  test('records grant creation as 201 and schedules bounded cleanup without delaying the result', async () => {
    telemetryEvents.length = 0;
    opportunisticCleanup.execute.mockClear();
    const useCase = new CreateProfilePhotoUpload(uow, mediaBase, imageStore, mediaSubjects, mediaPolicy, profileRepository, telemetry, opportunisticCleanup as never);
    await useCase.execute({ accountId: 'account', originSubject: 'opaque', revision: 1 });
    await Promise.resolve();
    expect(telemetryEvents[0]).toMatchObject({ name: 'profile.photo.grant', outcome: 'success', status: 201 });
    expect(opportunisticCleanup.execute).toHaveBeenCalledWith(2);
  });

  test('rejects a forged provider response without activating it', async () => {
    telemetryEvents.length = 0; const media = { ...mediaBase, activate: mock(async () => 'activated' as const) };
    const useCase = new FinalizeProfilePhotoUpload(uow, media, imageStore, telemetry, opportunisticCleanup as never);
    await expect(useCase.execute({ accountId: 'account', uploadId: 'upload', revision: 1, providerResponse: { public_id: 'wrong', signature: 'wrong' } })).rejects.toBeInstanceOf(ProfileError);
    expect(media.activate).not.toHaveBeenCalled(); expect(telemetryEvents[0]).toMatchObject({ name: 'profile.photo.reject', outcome: 'rejected', status: 422 });
  });

  test('rejects an expired upload before consulting the image provider', async () => {
    const verifyUploaded = mock(async () => ({ providerAssetId: 'asset', publicId: 'profiles/photo', version: 1, format: 'webp', bytes: 1024, width: 512, height: 512 }));
    const store = { ...imageStore, provider: 'fake' as const, verifyUploaded };
    const media = {
      ...mediaBase,
      findPending: mock(async () => ({ id: 'upload', accountId: 'account', publicId: 'profiles/photo', expiresAt: new Date(Date.now() - 1) })),
    };
    const useCase = new FinalizeProfilePhotoUpload(uow, media, store as never, telemetry, opportunisticCleanup as never);

    await expect(useCase.execute({ accountId: 'account', uploadId: 'upload', revision: 1, providerResponse: {} })).rejects.toMatchObject({ code: 'PHOTO_UPLOAD_EXPIRED' });
    expect(verifyUploaded).not.toHaveBeenCalled();
    expect(media.activate).not.toHaveBeenCalled();
  });

  test('keeps provider I/O outside transaction callbacks during grant and finalization', async () => {
    let transactionOpen = false;
    const guardedUow = {
      execute: async <T>(work: (value: object) => Promise<T>) => {
        transactionOpen = true;
        try { return await work(context); }
        finally { transactionOpen = false; }
      },
    };
    const createSignedUpload = mock(async () => {
      expect(transactionOpen).toBeFalse();
      return imageStore.createSignedUpload({ uploadId: 'upload', publicId: 'profiles/photo', expiresAt: new Date(Date.now() + 60_000) });
    });
    const verifyUploaded = mock(async () => {
      expect(transactionOpen).toBeFalse();
      return { providerAssetId: 'asset', publicId: 'profiles/photo', version: 1, format: 'webp' as const, bytes: 1024, width: 512, height: 512 };
    });
    const store = { ...imageStore, provider: 'fake' as const, createSignedUpload, verifyUploaded };

    await new CreateProfilePhotoUpload(guardedUow, mediaBase, store as never, mediaSubjects, mediaPolicy, profileRepository, telemetry, opportunisticCleanup as never)
      .execute({ accountId: 'account', originSubject: 'opaque', revision: 1 });
    await new FinalizeProfilePhotoUpload(guardedUow, mediaBase, store as never, telemetry, opportunisticCleanup as never)
      .execute({ accountId: 'account', uploadId: 'upload', revision: 1, providerResponse: {} });

    expect(createSignedUpload).toHaveBeenCalledTimes(1);
    expect(verifyUploaded).toHaveBeenCalledTimes(1);
  });

  test('removes only the active photo and surfaces optimistic conflicts', async () => {
    const marked = { ...mediaBase, removeActive: mock(async () => 'marked' as const) };
    const conflicted = { ...mediaBase, removeActive: mock(async () => 'conflict' as const) };

    await expect(new RemoveProfilePhoto(uow, marked, telemetry, opportunisticCleanup as never).execute({ accountId: 'account', revision: 1 }))
      .resolves.toEqual({ removed: true });
    await expect(new RemoveProfilePhoto(uow, conflicted, telemetry, opportunisticCleanup as never).execute({ accountId: 'account', revision: 1 }))
      .rejects.toMatchObject({ code: 'PROFILE_REVISION_CONFLICT' });
  });

  test('cleanup is bounded, idempotent and records aggregate counts', async () => {
    telemetryEvents.length = 0;
    const media = { ...mediaBase, listCleanup: mock(async (_context: object, _now: Date, limit: number) => [{ id: `asset-${limit}`, publicId: 'profiles/old' }]) };
    const useCase = new CleanupProfileMedia(uow, media, imageStore, telemetry);
    expect(await useCase.execute(1)).toEqual({ processed: 1, failed: 0 });
    expect(media.listCleanup).toHaveBeenCalledWith(context, expect.any(Date), 1); expect(media.cleanupSucceeded).toHaveBeenCalledWith(context, 'asset-1');
    expect(telemetryEvents[0]).toMatchObject({ name: 'profile.media.cleanup', processedCount: 1, failedCount: 0, provider: 'fake' });
  });

  test('records a failed provider deletion and retries it successfully on the next cleanup', async () => {
    let shouldFail = true;
    const store = {
      ...imageStore,
      provider: 'fake' as const,
      delete: mock(async () => {
        if (shouldFail) throw new Error('temporary provider failure');
        return 'deleted' as const;
      }),
    };
    const media = {
      ...mediaBase,
      listCleanup: mock(async () => [{ id: 'asset-retry', publicId: 'profiles/retry' }]),
      cleanupSucceeded: mock(async () => undefined),
      cleanupFailed: mock(async () => undefined),
    };
    const useCase = new CleanupProfileMedia(uow, media, store as never, telemetry);

    expect(await useCase.execute(1)).toEqual({ processed: 1, failed: 1 });
    expect(media.cleanupFailed).toHaveBeenCalledWith(context, 'asset-retry', expect.any(Date));
    shouldFail = false;
    expect(await useCase.execute(1)).toEqual({ processed: 1, failed: 0 });
    expect(media.cleanupSucceeded).toHaveBeenCalledWith(context, 'asset-retry');
  });
});

test('profile logger emits only the port allowlist plus a random correlation id', () => {
  const sink = mock((...args: unknown[]) => { void args; }); const original = Logger.log; Logger.log = sink as typeof Logger.log;
  try { new LoggerProfileTelemetryAdapter().record({ name: 'profile.update', outcome: 'success', status: 200, durationMs: 1.4 }); }
  finally { Logger.log = original; }
  const parsed = JSON.parse(sink.mock.calls[0]![0] as string) as Record<string, unknown>;
  expect(Object.keys(parsed).sort()).toEqual(['correlationId', 'durationMs', 'event', 'outcome', 'status']);
  expect(parsed.event).toBe('profile.update');
});
