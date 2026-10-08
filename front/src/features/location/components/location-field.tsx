'use client';

import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useState } from 'react';

import { AlertIcon } from '@/components/server/ui/icons';
import { envelopeSchema } from '@/features/registration/contracts';
import { cn } from '@/shared/ui/cn';

import {
  municipalityListDataSchema,
  type FederativeUnitOption,
  type MunicipalityOption,
  type UfCode,
} from '../contracts';

type LocationChange = Readonly<{
  ufCode: UfCode | '';
  municipalityCode: string;
  municipalityName: string;
}>;

type LocationFieldProps = Readonly<{
  federativeUnits: readonly FederativeUnitOption[];
  initialUfCode?: UfCode;
  initialMunicipalityCode?: string;
  initialMunicipalityName?: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: LocationChange) => void;
}>;

type SearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export function LocationField({
  federativeUnits,
  initialUfCode,
  initialMunicipalityCode = '',
  initialMunicipalityName = '',
  error,
  disabled = false,
  onChange,
}: LocationFieldProps) {
  const id = useId();
  const listboxId = `${id}-municipalities`;
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;
  const [ufCode, setUfCode] = useState<UfCode | ''>(initialUfCode ?? '');
  const [query, setQuery] = useState(initialMunicipalityName);
  const [selectedCode, setSelectedCode] = useState(initialMunicipalityCode);
  const [selectedName, setSelectedName] = useState(initialMunicipalityName);
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!ufCode || query.trim().length < 2 || (selectedCode && query === selectedName)) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus('loading');
      try {
        const response = await fetch(`/api/catalog/municipalities?uf=${encodeURIComponent(ufCode)}&q=${encodeURIComponent(query.trim())}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        const envelope = envelopeSchema.safeParse(body);
        const parsed = envelope.success ? municipalityListDataSchema.safeParse(envelope.data.data) : undefined;
        if (!response.ok || !parsed?.success) throw new Error('municipality_catalog_unavailable');
        setMunicipalities(parsed.data.municipalities);
        setStatus(parsed.data.municipalities.length ? 'ready' : 'empty');
        setActiveIndex(-1);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setMunicipalities([]);
        setStatus('error');
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryKey, selectedCode, selectedName, ufCode]);

  function emit(next: LocationChange) {
    onChange(next);
  }

  function changeUf(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as UfCode | '';
    setUfCode(next);
    setQuery('');
    setSelectedCode('');
    setSelectedName('');
    setMunicipalities([]);
    setStatus('idle');
    emit({ ufCode: next, municipalityCode: '', municipalityName: '' });
  }

  function changeQuery(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    setSelectedCode('');
    setSelectedName('');
    setMunicipalities([]);
    setStatus('idle');
    setActiveIndex(-1);
    emit({ ufCode, municipalityCode: '', municipalityName: '' });
  }

  function selectMunicipality(option: MunicipalityOption) {
    setQuery(option.name);
    setSelectedCode(option.code);
    setSelectedName(option.name);
    setMunicipalities([]);
    setStatus('idle');
    setActiveIndex(-1);
    emit({ ufCode: option.ufCode, municipalityCode: option.code, municipalityName: option.name });
  }

  function onQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && municipalities.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % municipalities.length);
    } else if (event.key === 'ArrowUp' && municipalities.length) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? municipalities.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0 && municipalities[activeIndex]) {
      event.preventDefault();
      selectMunicipality(municipalities[activeIndex]);
    } else if (event.key === 'Escape') {
      setMunicipalities([]);
      setActiveIndex(-1);
    }
  }

  const hintId = `${id}-hint`;
  const describedBy = [hintId, statusId, error ? errorId : undefined].filter(Boolean).join(' ');
  const statusText = status === 'loading'
    ? 'Buscando municípios…'
    : status === 'empty'
      ? 'Nenhum município encontrado.'
      : status === 'error'
        ? 'Não foi possível buscar municípios.'
        : query.trim().length < 2
          ? 'Digite pelo menos duas letras para buscar.'
          : '';

  return (
    <fieldset className="space-y-5" aria-describedby={error ? errorId : hintId}>
      <legend className="font-semibold">Onde você mora?</legend>
      <p id={hintId} className="text-sm text-muted-foreground">
        Escolha seu estado e município. Não pedimos endereço, bairro, CEP ou sua localização do aparelho.
      </p>
      <label className="block space-y-2">
        <span className="font-semibold">Estado</span>
        <select
          name="ufCode"
          value={ufCode}
          onChange={changeUf}
          disabled={disabled}
          required
          className="block min-h-13 w-full rounded-xl border-2 border-border bg-surface px-4 text-lg text-foreground hover:border-muted-foreground focus-visible:border-foreground focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:text-disabled"
        >
          <option value="">Escolha um estado</option>
          {federativeUnits.map((unit) => (
            <option key={unit.code} value={unit.code}>{unit.name} ({unit.code})</option>
          ))}
        </select>
      </label>
      <div className="relative space-y-2">
        <label htmlFor={`${id}-municipality`} className="block font-semibold">Município</label>
        <input
          id={`${id}-municipality`}
          name="municipalityQuery"
          role="combobox"
          value={query}
          onChange={changeQuery}
          onKeyDown={onQueryKeyDown}
          disabled={disabled || !ufCode}
          required
          autoComplete="off"
          placeholder={ufCode ? 'Digite o município' : 'Escolha primeiro seu estado'}
          aria-expanded={municipalities.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${municipalities[activeIndex]?.code}` : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? errorId : undefined}
          className={cn(
            'block min-h-13 w-full rounded-xl border-2 bg-surface px-4 text-lg text-foreground transition-colors duration-200',
            'placeholder:text-disabled hover:border-muted-foreground focus-visible:border-foreground focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:text-disabled',
            error ? 'border-error' : 'border-border',
          )}
        />
        <input type="hidden" name="municipalityCode" value={selectedCode} />
        <div id={statusId} aria-live="polite" className="text-sm text-muted-foreground">
          {statusText}
          {status === 'error' ? (
            <button type="button" className="ms-2 font-semibold text-primary underline underline-offset-4" onClick={() => setRetryKey((value) => value + 1)}>
              Tentar novamente
            </button>
          ) : null}
        </div>
        {municipalities.length ? (
          <ul id={listboxId} role="listbox" aria-label="Municípios encontrados" className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border-2 border-border bg-card p-1">
            {municipalities.map((municipality, index) => (
              <li
                key={municipality.code}
                id={`${listboxId}-${municipality.code}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn('min-h-11 cursor-pointer rounded-lg px-3 py-2.5', index === activeIndex ? 'bg-primary-muted text-foreground' : 'hover:bg-surface')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectMunicipality(municipality)}
              >
                {municipality.name}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p id={errorId} className="flex items-start gap-2 text-sm font-semibold text-error"><AlertIcon className="mt-0.5 size-4 shrink-0" />{error}</p> : null}
      </div>
    </fieldset>
  );
}
