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
};

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
    expect(new ProfilePreviewProjector().project(state)).toEqual({ displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: state.interests });
  });
});
