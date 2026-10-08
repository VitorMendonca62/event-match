import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileAvailabilityField } from '../../src/features/profile/components/profile-availability-field';
import { ownProfileSchema, profilePreviewSchema, type OwnProfile } from '../../src/features/profile/contracts';

const base: OwnProfile = {
  revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: [], presentation: null,
  photoVisibility: 'private', presentationVisibility: 'private', photo: null, pronounSelection: null, customPronouns: null,
  pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languages: [], languagesVisibility: 'private',
  activityPreferences: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null, socialLinks: [],
  completion: { complete: false, completedCount: 4, totalCount: 6, missing: ['photo', 'presentation'] },
};

const render = (initial: OwnProfile = base) => renderToStaticMarkup(<ProfileAvailabilityField initial={initial} onDirty={() => {}} />);

describe('availability and distance field (SDD-018 / ADR-045)', () => {
  test('renders the accessible 7 by 4 calendar, presets, live counter and private distance range', () => {
    const markup = render({ ...base, availabilitySlots: ['fri_early_hours', 'sat_evening'], preferredDistance: 'up_to_5km' });
    expect(markup).toContain('Quando e até onde você costuma ir');
    expect(markup).toContain('A madrugada de sexta vai da 0h às 6h de sexta.');
    expect((markup.match(/name="availabilitySlots"/g) ?? []).length).toBe(28);
    expect(markup).toContain('Dias úteis à noite');
    expect(markup).toContain('Fins de semana');
    expect(markup).toContain('Limpar');
    expect(markup).toContain('type="range"');
    expect(markup).toContain('name="preferredDistanceRange"');
    expect(markup).toContain('name="preferredDistance"');
    expect(markup).toContain('Até onde você costuma se deslocar?');
    expect(markup).toContain('aria-valuetext="Até 5 km"');
    expect(markup).toContain('value="up_to_5km"');
    expect(markup).toContain('aria-label="Escolha uma faixa de distância"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Toda a cidade');
    expect(markup).toContain('aria-label="Qualquer lugar na minha cidade"');
    expect(markup).toContain('Não informar');
    expect(markup).toContain('Até 5 km');
    expect(markup).toContain('Só você vê estas informações.');
  });

  test('keeps the own contract closed and preview strict', () => {
    expect(ownProfileSchema.safeParse({ ...base, availabilitySlots: ['sat_evening'], preferredDistance: 'same_city' }).success).toBeTrue();
    expect(ownProfileSchema.safeParse({ ...base, availabilitySlots: ['sat_evening', 'sat_evening'] }).success).toBeFalse();
    expect(ownProfileSchema.safeParse({ ...base, preferredDistance: 'up_to_100km' }).success).toBeFalse();
    const preview = { displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: [] };
    expect(profilePreviewSchema.safeParse({ ...preview, availabilitySlots: ['sat_evening'] }).success).toBeFalse();
    expect(profilePreviewSchema.safeParse({ ...preview, preferredDistance: 'same_city' }).success).toBeFalse();
  });

  test('associates each validation error with its own fieldset', () => {
    const markup = renderToStaticMarkup(
      <ProfileAvailabilityField
        initial={base}
        availabilityError="Escolha até 28 períodos, sem repetições."
        preferredDistanceError="Escolha uma faixa válida ou “Não informar”."
        onDirty={() => {}}
      />,
    );
    expect(markup).toContain('aria-describedby="availability-hint availability-note availability-error"');
    expect(markup).toContain('aria-describedby="distance-hint preferred-distance-error"');
    expect(markup).toContain('aria-describedby="preferred-distance-value preferred-distance-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="availability-error"');
    expect(markup).toContain('id="preferred-distance-error"');
  });
});
