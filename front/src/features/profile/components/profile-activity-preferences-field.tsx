'use client';

import { useState } from 'react';
import { Choice } from '@/components/server/ui/choice';
import { Notice } from '@/components/server/ui/notice';
import { MAX_ACTIVITY_PREFERENCES, type ActivityPreferenceOption, type OwnProfile } from '../contracts';
import { ProfileVisibilityToggle } from './profile-visibility-toggle';

type Props = Readonly<{
  initial: OwnProfile;
  /** Active catalog in stable order, or `null` when the catalog could not be loaded. */
  options: readonly ActivityPreferenceOption[] | null;
  error?: string;
  onDirty: () => void;
}>;

/**
 * Optional, unordered set of up to five activity preferences (ADR-044). Selection is a
 * native checkbox group; the selected set is the only state, everything else is derived.
 */
export function ProfileActivityPreferencesField({ initial, options, error, onDirty }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(initial.activityPreferences.map(({ code }) => code)),
  );
  // Discontinued items stay visible only while still selected; once removed they never return.
  const discontinued = initial.activityPreferences.filter(({ active, code }) => !active && selected.has(code));
  const limitReached = selected.size >= MAX_ACTIVITY_PREFERENCES;
  const descriptionIds = ['activity-preferences-hint', limitReached ? 'activity-preferences-limit' : null, error ? 'activity-preferences-error' : null]
    .filter(Boolean)
    .join(' ');

  function toggle(code: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    onDirty();
  }

  return (
    <section aria-labelledby="profile-activity-preferences" className="space-y-5">
      <div>
        <h3 id="profile-activity-preferences" className="text-lg font-bold">
          Como você gosta dos encontros
        </h3>
        <p id="activity-preferences-hint" className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
          Interesses dizem do que você gosta; aqui, como prefere que o encontro seja. Opcional, até cinco, sem ordem de
          prioridade.
        </p>
      </div>
      {options === null ? (
        <>
          {[...selected].map((code) => (
            <input key={code} type="hidden" name="activityPreferenceCodes" value={code} />
          ))}
          <Notice tone="warning" title="Não conseguimos carregar as opções agora.">
            Suas escolhas atuais continuam salvas e serão mantidas se você salvar o perfil. Recarregue a página para editá-las.
          </Notice>
        </>
      ) : (
        <fieldset aria-describedby={descriptionIds} className="space-y-4">
          <legend className="flex w-full items-end justify-between gap-4">
            <span className="text-sm font-semibold">Preferências de atividades</span>
            <span aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
              <span className="sr-only">Selecionadas: </span>
              {selected.size}/{MAX_ACTIVITY_PREFERENCES}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {options.map((item) => {
              const checked = selected.has(item.code);
              const blocked = limitReached && !checked;
              return (
                <Choice
                  key={item.code}
                  appearance="chip"
                  type="checkbox"
                  name="activityPreferenceCodes"
                  value={item.code}
                  label={item.label}
                  checked={checked}
                  aria-disabled={blocked || undefined}
                  className={blocked ? 'cursor-not-allowed border-dashed bg-transparent text-muted-foreground hover:border-border' : undefined}
                  onClick={(event) => { if (blocked) event.preventDefault(); }}
                  onChange={(event) => { if (!blocked) toggle(item.code, event.currentTarget.checked); }}
                />
              );
            })}
            {discontinued.map((item) => (
              <Choice
                key={item.code}
                appearance="chip"
                type="checkbox"
                name="activityPreferenceCodes"
                value={item.code}
                label={item.label}
                badge="Opção descontinuada"
                checked
                onChange={() => toggle(item.code, false)}
              />
            ))}
          </div>
          {discontinued.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Opções descontinuadas podem ser mantidas, mas não voltam depois de desmarcadas. Se quiser, escolha outra.
            </p>
          ) : null}
          {limitReached ? (
            <p id="activity-preferences-limit" className="text-sm text-muted-foreground">
              Você escolheu as cinco preferências possíveis. Para trocar alguma, desmarque uma delas primeiro.
            </p>
          ) : null}
          {error ? (
            <p id="activity-preferences-error" className="font-semibold text-error">
              {error}
            </p>
          ) : null}
        </fieldset>
      )}
      <ProfileVisibilityToggle
        name="activityPreferencesVisibility"
        question="Compartilhar preferências futuramente?"
        description="Ative para mostrar a lista a pessoas autenticadas quando esse recurso estiver disponível."
        defaultChecked={initial.activityPreferencesVisibility === 'authenticated'}
      />
    </section>
  );
}
