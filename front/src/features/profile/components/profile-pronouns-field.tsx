'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { TextField } from '@/components/server/ui/text-field';
import type { OwnProfile } from '../contracts';
import { ProfileVisibilityToggle } from './profile-visibility-toggle';

type PronounSelection = OwnProfile['pronounSelection'];

const OPTIONS: ReadonlyArray<Readonly<{ value: PronounSelection; label: string }>> = [
  { value: null, label: 'Não informado' },
  { value: 'ela_dela', label: 'Ela/dela' },
  { value: 'ele_dele', label: 'Ele/dele' },
  { value: 'elu_delu', label: 'Elu/delu' },
  { value: 'other', label: 'Outro' },
  { value: 'prefer_not_to_say', label: 'Prefiro não informar' },
];

export function ProfilePronounsField({ initial, error, onDirty }: Readonly<{ initial: OwnProfile; error?: string; onDirty: () => void }>) {
  const [selection, setSelection] = useState(initial.pronounSelection);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, OPTIONS.findIndex((option) => option.value === initial.pronounSelection)));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = `${useId()}-pronouns`;
  const preferPrivate = selection === 'prefer_not_to_say';
  // Switching between pronouns keeps the person's sharing choice (the toggle only remounts on
  // entering/leaving "Prefiro não informar"); leaving that refusal always reopens as private.
  const [shareByDefault, setShareByDefault] = useState(initial.pronounsVisibility === 'authenticated');
  // With "Outro" open, the text field owns and announces the error; otherwise the group does.
  const groupError = selection === 'other' ? undefined : error;

  useEffect(() => {
    if (!isOpen) return;

    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeWhenClickingOutside);
    return () => document.removeEventListener('pointerdown', closeWhenClickingOutside);
  }, [isOpen]);

  const chooseOption = (index: number) => {
    const option = OPTIONS[index];
    if (!option) return;
    setSelection(option.value);
    if (option.value === 'prefer_not_to_say') setShareByDefault(false);
    setActiveIndex(index);
    setIsOpen(false);
    onDirty();
    triggerRef.current?.focus();
  };

  const selectedOption = OPTIONS.find((option) => option.value === selection) ?? OPTIONS[0];

  return (
    <fieldset className="space-y-4" aria-describedby={groupError ? 'pronouns-error' : undefined}>
      <legend className="font-semibold">Pronomes</legend>
      <p className="text-sm text-muted-foreground">Escolha como prefere ser mencionada, mencionado ou mencionade.</p>
      <div className="relative" ref={rootRef}>
        <input name="pronounSelection" type="hidden" value={selection ?? ''} />
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-activedescendant={isOpen ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-invalid={error ? true : undefined}
          aria-label="Pronomes"
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false);
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (isOpen) chooseOption(activeIndex);
              else setIsOpen(true);
              return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const direction = event.key === 'ArrowDown' ? 1 : -1;
              setActiveIndex((current) => (current + direction + OPTIONS.length) % OPTIONS.length);
              setIsOpen(true);
              return;
            }
            if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              setActiveIndex(event.key === 'Home' ? 0 : OPTIONS.length - 1);
              setIsOpen(true);
            }
          }}
          className="flex min-h-13 w-full items-center justify-between gap-4 rounded-xl border-2 border-border bg-surface px-4 text-left text-lg text-foreground transition-colors hover:border-muted-foreground focus-visible:border-foreground"
        >
          <span>{selectedOption.label}</span>
          <svg aria-hidden="true" className={`size-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none">
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
          </svg>
        </button>
        {isOpen ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Opções de pronomes"
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border-2 border-border bg-card p-1"
          >
            {OPTIONS.map((option, index) => {
              const selected = option.value === selection;
              const active = index === activeIndex;
              return (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={option.value ?? 'not-informed'}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseOption(index)}
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : active
                        ? 'bg-primary-muted text-foreground'
                        : 'text-foreground hover:bg-primary-muted'
                  }`}
                >
                  <span>{option.label}</span>
                  {selected ? (
                    <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 20 20" fill="none">
                      <path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {preferPrivate ? <p className="text-sm text-muted-foreground">A escolha fica registrada somente para você.</p> : null}
      {selection === 'other' ? <TextField name="customPronouns" label="Como devemos escrever?" maxLength={40} defaultValue={initial.customPronouns ?? ''} error={error} /> : <input type="hidden" name="customPronouns" value="" />}
      {groupError ? <p id="pronouns-error" className="font-semibold text-error">{groupError}</p> : null}
      <ProfileVisibilityToggle key={preferPrivate ? 'refused' : 'open'} name="pronounsVisibility" question="Compartilhar pronomes futuramente?" description={preferPrivate ? '“Prefiro não informar” permanece sempre privado.' : 'Ative para mostrar a pessoas autenticadas quando esse recurso estiver disponível.'} defaultChecked={!preferPrivate && shareByDefault} disabled={preferPrivate} />
    </fieldset>
  );
}
