import { describe, expect, test } from 'bun:test';
import { Profile } from '../../../src/modules/profiles/domain/entities/profile';
import { ProfileError } from '../../../src/modules/profiles/domain/errors/profile.error';
import { ProfileCompletion } from '../../../src/modules/profiles/domain/services/profile-completion';
import { ProfilePreviewProjector } from '../../../src/modules/profiles/domain/services/profile-preview-projector';

const state = {
  accountId: '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50', revision: 1,
  displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'] as const,
  interests: [
    { id: '1', slug: 'cinema', label: 'Cinema' }, { id: '2', slug: 'corrida', label: 'Corrida' }, { id: '3', slug: 'livros', label: 'Livros' },
  ], presentation: null, photoVisibility: 'private' as const, presentationVisibility: 'private' as const, photo: null,
  pronounSelection: null, customPronouns: null, pronounsVisibility: 'private' as const,
  profession: null, professionVisibility: 'private' as const, languages: [], languagesVisibility: 'private' as const,
  activityPreferences: [] as { code: string; label: string; active: boolean }[], activityPreferencesVisibility: 'private' as const,
  availabilitySlots: [], preferredDistance: null, socialLinks: [],
};
const PRONOUN_LABELS = { ela_dela: 'Ela/dela', ele_dele: 'Ele/dele', elu_delu: 'Elu/delu' } as const;

describe('Profile (ADR-038)', () => {
  test('normalizes an atomic edit and increments its optimistic revision', () => {
    const updated = Profile.restore(state).update({ ...state, displayName: '  Ana   Silva ', presentation: ' Gosto de atividades em grupo. ', photoVisibility: 'authenticated', presentationVisibility: 'authenticated' }).snapshot();
    expect(updated.displayName).toBe('Ana Silva'); expect(updated.presentation).toBe('Gosto de atividades em grupo.'); expect(updated.revision).toBe(2);
  });
  test('rejects duplicates, fewer than three interests and evident contact', () => {
    expect(() => Profile.restore(state).update({ ...state, interests: state.interests.slice(0, 2) })).toThrow(ProfileError);
    expect(() => Profile.restore(state).update({ ...state, presentation: 'fale comigo em ana@example.test' })).toThrow(ProfileError);
  });
  test('completion has six stable items and preview omits private fields', () => {
    const completion = new ProfileCompletion().calculate(state); expect(completion).toEqual({ complete: false, completedCount: 4, totalCount: 6, missing: ['photo', 'presentation'] });
    expect(new ProfilePreviewProjector().project(state, PRONOUN_LABELS)).toEqual({ displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: state.interests });
  });
  test('normalizes optional identity and projects only authenticated groups', () => {
    const updated = Profile.restore(state).update({ ...state, pronounSelection: 'other', customPronouns: ' elu / delu ', pronounsVisibility: 'authenticated', profession: ' Pessoa desenvolvedora ', professionVisibility: 'authenticated', languages: [{ code: 'bzs', label: 'Libras', active: true }], languagesVisibility: 'authenticated' }).snapshot();
    expect(updated.customPronouns).toBe('elu / delu');
    expect(new ProfilePreviewProjector().project(updated, PRONOUN_LABELS)).toMatchObject({ pronouns: 'elu / delu', profession: 'Pessoa desenvolvedora', languages: [{ code: 'bzs', label: 'Libras' }] });
    expect(() => Profile.restore(state).update({ ...state, pronounSelection: 'prefer_not_to_say', customPronouns: null, pronounsVisibility: 'authenticated' })).toThrow(ProfileError);
  });
  describe('preview projection matrix for optional identity', () => {
    const projector = new ProfilePreviewProjector();
    const filled = { ...state, profession: 'Produtora', languages: [{ code: 'bzs', label: 'Libras', active: false }] };
    const pronounCases = [
      { pronounSelection: null, customPronouns: null, expected: undefined },
      { pronounSelection: 'ela_dela' as const, customPronouns: null, expected: 'Ela/dela' },
      { pronounSelection: 'ele_dele' as const, customPronouns: null, expected: 'Ele/dele' },
      { pronounSelection: 'elu_delu' as const, customPronouns: null, expected: 'Elu/delu' },
      { pronounSelection: 'other' as const, customPronouns: 'ile/dile', expected: 'ile/dile' },
    ];
    for (const visibility of ['private', 'authenticated'] as const) {
      for (const { pronounSelection, customPronouns, expected } of pronounCases) {
        test(`pronouns ${pronounSelection ?? 'absent'} with ${visibility} audience`, () => {
          const preview = projector.project({ ...filled, pronounSelection, customPronouns, pronounsVisibility: visibility }, PRONOUN_LABELS);
          expect(preview.pronouns).toBe(visibility === 'authenticated' ? expected : undefined);
          if (visibility === 'private' || expected === undefined) expect(preview).not.toHaveProperty('pronouns');
        });
      }
      test(`profession and languages with ${visibility} audience`, () => {
        const preview = projector.project({ ...filled, professionVisibility: visibility, languagesVisibility: visibility }, PRONOUN_LABELS);
        if (visibility === 'authenticated') expect(preview).toMatchObject({ profession: 'Produtora', languages: [{ code: 'bzs', label: 'Libras' }] });
        else { expect(preview).not.toHaveProperty('profession'); expect(preview).not.toHaveProperty('languages'); }
      });
    }
    test('prefer_not_to_say is never projected, even if persisted with a wider audience', () => {
      const preview = projector.project({ ...filled, pronounSelection: 'prefer_not_to_say', pronounsVisibility: 'authenticated' }, PRONOUN_LABELS);
      expect(preview).not.toHaveProperty('pronouns');
      expect(JSON.stringify(preview)).not.toContain('prefer_not_to_say');
    });
    test('absent groups are omitted and language catalog state never leaks', () => {
      const preview = projector.project({ ...state, profession: null, languages: [], professionVisibility: 'authenticated', languagesVisibility: 'authenticated' }, PRONOUN_LABELS);
      expect(preview).not.toHaveProperty('profession');
      expect(preview).not.toHaveProperty('languages');
      const withLanguages = projector.project({ ...filled, languagesVisibility: 'authenticated' }, PRONOUN_LABELS);
      expect(withLanguages.languages?.[0]).toEqual({ code: 'bzs', label: 'Libras' });
    });
  });
  describe('activity preferences (ADR-044)', () => {
    const option = (code: string, active = true) => ({ code, label: `Rótulo ${code}`, active });
    const five = ['outdoor', 'indoor', 'quiet_setting', 'small_group', 'medium_group'].map((code) => option(code));
    test('accepts absence and up to five unique preferences', () => {
      expect(Profile.restore(state).update(state).snapshot().activityPreferences).toEqual([]);
      expect(Profile.restore(state).update({ ...state, activityPreferences: five }).snapshot().activityPreferences).toHaveLength(5);
    });
    test('rejects six, duplicates and public visibility', () => {
      expect(() => Profile.restore(state).update({ ...state, activityPreferences: [...five, option('lively_setting')] })).toThrow(ProfileError);
      expect(() => Profile.restore(state).update({ ...state, activityPreferences: [option('outdoor'), option('outdoor')] })).toThrow(ProfileError);
      expect(() => Profile.restore(state).update({ ...state, activityPreferencesVisibility: 'public' })).toThrow(ProfileError);
    });
    const projector = new ProfilePreviewProjector();
    for (const visibility of ['private', 'authenticated'] as const) {
      for (const selected of [[], [option('small_group', false)]]) {
        test(`preview with ${visibility} audience and ${selected.length} preference(s)`, () => {
          const preview = projector.project({ ...state, activityPreferences: selected, activityPreferencesVisibility: visibility }, PRONOUN_LABELS);
          if (visibility === 'authenticated' && selected.length > 0) expect(preview.activityPreferences).toEqual([{ code: 'small_group', label: 'Rótulo small_group' }]);
          else expect(preview).not.toHaveProperty('activityPreferences');
          expect(JSON.stringify(preview)).not.toContain('active');
        });
      }
    }
  });
  describe('availability and distance (ADR-045)', () => {
    test('accepts the complete grid, canonicalizes slots and keeps distance optional', () => {
      const updated = Profile.restore(state).update({
        ...state,
        availabilitySlots: ['sun_evening', 'fri_early_hours', 'mon_morning'],
        preferredDistance: 'up_to_5km',
      }).snapshot();
      expect(updated.availabilitySlots).toEqual(['mon_morning', 'fri_early_hours', 'sun_evening']);
      expect(updated.preferredDistance).toBe('up_to_5km');
      expect(Profile.restore(state).update({ ...state, availabilitySlots: [] }).snapshot().preferredDistance).toBeNull();
    });

    test('rejects unknown, duplicate and oversized availability payloads and invalid distance', () => {
      expect(() => Profile.restore(state).update({ ...state, availabilitySlots: ['mon_morning', 'mon_morning'] })).toThrow(ProfileError);
      expect(() => Profile.restore(state).update({ ...state, availabilitySlots: ['not_a_slot' as never] })).toThrow(ProfileError);
      expect(() => Profile.restore(state).update({ ...state, availabilitySlots: Array.from({ length: 29 }, () => 'mon_morning' as const) })).toThrow(ProfileError);
      expect(() => Profile.restore(state).update({ ...state, preferredDistance: 'up_to_100km' as never })).toThrow(ProfileError);
    });

    test('does not project availability or distance into preview', () => {
      const updated = Profile.restore(state).update({ ...state, availabilitySlots: ['sat_evening'], preferredDistance: 'same_city' }).snapshot();
      const preview = new ProfilePreviewProjector().project(updated, PRONOUN_LABELS);
      expect(preview).not.toHaveProperty('availabilitySlots');
      expect(preview).not.toHaveProperty('preferredDistance');
      expect(JSON.stringify(preview)).not.toContain('sat_evening');
      expect(JSON.stringify(preview)).not.toContain('same_city');
    });
  });

  describe('social links (ADR-049)', () => {
    const links = [
      { id: '00000000-0000-4000-8000-000000000001', provider: 'instagram' as const, canonicalIdentifier: 'ana', position: 1, visibility: 'private' as const },
      { id: '00000000-0000-4000-8000-000000000002', provider: 'linkedin' as const, canonicalIdentifier: 'ana-silva', position: 2, visibility: 'authenticated' as const },
    ];

    test('accepts ordered links and only projects authenticated links with derived URLs', () => {
      const updated = Profile.restore(state).update({ ...state, socialLinks: [...links].reverse() }).snapshot();
      expect(updated.socialLinks.map(({ position }) => position)).toEqual([1, 2]);
      expect(new ProfilePreviewProjector().project(updated, PRONOUN_LABELS).socialLinks).toEqual([
        { provider: 'linkedin', identifier: 'ana-silva', url: 'https://www.linkedin.com/in/ana-silva' },
      ]);
    });

    test('rejects public links, repeated providers and repeated positions', () => {
      expect(() => Profile.restore(state).update({ ...state, socialLinks: [{ ...links[0], visibility: 'public' }] })).toThrow(ProfileError);
      expect(() => Profile.restore(state).update({ ...state, socialLinks: [links[0], { ...links[1], provider: 'instagram' }] })).toThrow(ProfileError);
      expect(() => Profile.restore(state).update({ ...state, socialLinks: [links[0], { ...links[1], position: 1 }] })).toThrow(ProfileError);
    });
  });
});
