import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileActivityPreferencesField } from '../../src/features/profile/components/profile-activity-preferences-field';
import { ownProfileSchema, profilePreviewSchema, type OwnProfile } from '../../src/features/profile/contracts';
import { ACTIVITY_PREFERENCE_REJECTION_MESSAGES } from '../../src/features/profile/messages';

const OPTIONS = [
  ['outdoor', 'Ao ar livre'], ['indoor', 'Ambiente interno'], ['quiet_setting', 'Ambiente tranquilo'],
  ['lively_setting', 'Ambiente movimentado'], ['small_group', 'Grupo pequeno'], ['medium_group', 'Grupo médio'],
].map(([code, label]) => ({ code: code!, label: label! }));
const base: OwnProfile = {
  revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: [], presentation: null,
  photoVisibility: 'private', presentationVisibility: 'private', photo: null, pronounSelection: null, customPronouns: null,
  pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languages: [], languagesVisibility: 'private',
  activityPreferences: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null, socialLinks: [],
  completion: { complete: false, completedCount: 4, totalCount: 6, missing: ['photo', 'presentation'] },
};
const render = (initial: OwnProfile, options: typeof OPTIONS | null = OPTIONS) =>
  renderToStaticMarkup(<ProfileActivityPreferencesField initial={initial} options={options} onDirty={() => {}} />);
const selected = (codes: readonly string[], inactive: readonly string[] = []) =>
  codes.map((code) => ({ code, label: OPTIONS.find((item) => item.code === code)?.label ?? `Antiga ${code}`, active: !inactive.includes(code) }));

describe('activity preferences field (SDD-017)', () => {
  test('renders a labelled checkbox group in catalog order with a live counter and private default', () => {
    const markup = render(base);
    expect(markup).toContain('Como você gosta dos encontros');
    expect(markup).toMatch(/<fieldset[^>]*>/);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toMatch(/0(<!-- -->)?\/(<!-- -->)?5/);
    const order = OPTIONS.map(({ code }) => markup.indexOf(`value="${code}"`));
    expect(order.every((position) => position > 0)).toBeTrue();
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markup).toContain('name="activityPreferencesVisibility"');
    expect(markup).not.toContain('aria-disabled');
  });

  test('at five, unselected options stay visible but aria-disabled with a textual explanation', () => {
    const markup = render({ ...base, activityPreferences: selected(['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group']) });
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(1);
    expect(markup).toMatch(/<input[^>]*aria-disabled="true"[^>]*value="medium_group"|<input[^>]*value="medium_group"[^>]*aria-disabled="true"/);
    expect(markup).toContain('Você escolheu as cinco preferências possíveis');
    expect(markup).toContain('Grupo médio');
  });

  test('a discontinued selection stays checked, labelled and explained', () => {
    const markup = render({ ...base, activityPreferences: selected(['outdoor', 'retired_option'], ['retired_option']) });
    expect(markup).toContain('Opção descontinuada');
    expect(markup).toContain('value="retired_option"');
    expect(markup).toContain('não voltam depois de desmarcadas');
  });

  test('a failing catalog degrades only the section and preserves the current selection', () => {
    const markup = render({ ...base, activityPreferences: selected(['small_group']) }, null);
    expect(markup).toContain('Não conseguimos carregar as opções agora.');
    expect(markup).toContain('<input type="hidden" name="activityPreferenceCodes" value="small_group"/>');
    expect(markup).not.toContain('<fieldset');
    expect(markup).toContain('name="activityPreferencesVisibility"');
  });

  test('contracts are strict: the own view carries active, the preview never does', () => {
    expect(ownProfileSchema.safeParse({ ...base, activityPreferences: selected(['outdoor']) }).success).toBeTrue();
    expect(ownProfileSchema.safeParse({ ...base, activityPreferences: selected(['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group', 'medium_group']) }).success).toBeFalse();
    const preview = { displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: [] };
    expect(profilePreviewSchema.safeParse({ ...preview, activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre' }] }).success).toBeTrue();
    expect(profilePreviewSchema.safeParse({ ...preview, activityPreferences: [{ code: 'outdoor', label: 'Ao ar livre', active: true }] }).success).toBeFalse();
    expect(Object.keys(ACTIVITY_PREFERENCE_REJECTION_MESSAGES).sort()).toEqual(['inactive_activity_preference', 'unknown_activity_preference']);
  });
});
