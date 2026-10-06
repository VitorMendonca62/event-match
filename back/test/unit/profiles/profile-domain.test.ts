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
});
