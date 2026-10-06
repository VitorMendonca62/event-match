'use client';

import { useRef, useState } from 'react';
import type { LanguageOption, OwnProfile } from '../contracts';
import { ProfileVisibilityToggle } from './profile-visibility-toggle';

export function ProfileLanguagePicker({ initial, options, error, onDirty }: Readonly<{ initial: OwnProfile; options: readonly LanguageOption[]; error?: string; onDirty: () => void }>) {
  const initialOptions = initial.languages;
  const [selected, setSelected] = useState(initialOptions);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const selectedCodes = new Set(selected.map(({ code }) => code));
  const available = options.filter(({ code, label }) => !selectedCodes.has(code) && (!normalizedQuery || label.toLocaleLowerCase('pt-BR').includes(normalizedQuery)));
  const limitReached = selected.length >= 5;
  return (
    <fieldset className="space-y-4" aria-describedby={error ? 'languages-error' : undefined}>
      <legend className="sr-only">Idiomas</legend>
      <div className="flex items-end justify-between gap-4"><span aria-hidden="true" className="font-semibold">Idiomas</span><span className="text-sm tabular-nums text-muted-foreground">{selected.length}/5</span></div>
      <p className="text-sm text-muted-foreground">Inclua idiomas que você usa para se comunicar. Não pedimos nível de proficiência.</p>
      {selected.length > 0 ? <ul className="flex flex-wrap gap-2">{selected.map((item) => <li key={item.code} className="flex min-h-12 items-center gap-2 rounded-full border-2 border-foreground bg-primary-muted py-1 ps-4 pe-1"><input type="hidden" name="languageCodes" value={item.code} /><span className="font-semibold">{item.label}{item.active ? '' : ' (indisponível)'}</span><button type="button" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-warning" aria-label={`Remover ${item.label}`} onClick={() => { setSelected((items) => items.filter(({ code }) => code !== item.code)); onDirty(); }}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2"><path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" /></svg></button></li>)}</ul> : <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum idioma selecionado.</p>}
      <div className="group/language-search space-y-2">
        <label className="block space-y-2"><span className="font-semibold">Buscar idioma</span><input ref={searchInputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="block min-h-13 w-full rounded-xl border-2 border-border bg-surface px-4 text-foreground hover:border-muted-foreground focus-visible:border-foreground" placeholder="Ex.: Libras" /></label>
        <div className="hidden group-focus-within/language-search:block">
          {limitReached ? <p className="font-semibold text-warning">Limite de cinco idiomas atingido. Remova um para escolher outro.</p> : available.length > 0 ? <ul className="max-h-56 overflow-y-auto rounded-2xl border-2 border-border bg-surface p-2">{available.map((item) => <li key={item.code}><button type="button" className="min-h-11 w-full rounded-xl px-3 text-left font-semibold hover:bg-primary-muted focus-visible:outline-3 focus-visible:outline-warning" onClick={() => { setSelected((items) => [...items, { ...item, active: true }]); onDirty(); searchInputRef.current?.focus(); }}>{item.label}</button></li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum idioma encontrado.</p>}
        </div>
      </div>
      {error ? <p id="languages-error" className="font-semibold text-error">{error}</p> : null}
      <ProfileVisibilityToggle name="languagesVisibility" question="Compartilhar idiomas futuramente?" description="Ative para mostrar a lista a pessoas autenticadas quando esse recurso estiver disponível." defaultChecked={initial.languagesVisibility === 'authenticated'} />
    </fieldset>
  );
}
