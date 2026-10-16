'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';
import { LocationField } from '@/features/location/components/location-field';
import type { FederativeUnitOption, UfCode } from '@/features/location/contracts';
import { saveEventDraft, readEventDraft, previewEventDraft, publishEventDraft, type EventApiFailure } from '../api';
import { eventPreviewSchema, updateEventDraftRequestSchema, type EventActivityType, type EventOwnerDraft, type EventPreview } from '../contracts';
import { saveEventDraftReference } from '../draft-reference';
import type { MapPoint } from './open-street-map';
import { EventSectionNav, type EventSectionNavStatuses } from './event-section-nav';

const EventLocationPicker = dynamic(
  () => import('./event-location-picker').then((module) => module.EventLocationPicker),
  { ssr: false, loading: () => <div role="status" className="min-h-20 rounded-xl border-2 border-border bg-card p-4 text-sm text-muted-foreground">Preparando o mapa…</div> },
);
const ApproximateAreaMap = dynamic(
  () => import('./event-location-picker').then((module) => module.ApproximateAreaMap),
  { ssr: false, loading: () => <div role="status" className="h-72 rounded-xl border-2 border-border bg-card p-4 text-sm text-muted-foreground">Carregando o mapa da área aproximada…</div> },
);

type FormValues = {
  activityTypeCode: string;
  title: string;
  description: string;
  ufCode: UfCode | '';
  municipalityCode: string;
  municipalityName: string;
  startsAtLocal: string;
  endsAtLocal: string;
  venueType: '' | 'public_place' | 'identifiable_establishment';
  nonResidentialHostDeclaration: boolean;
  latitude: string;
  longitude: string;
  capacity: string;
  admissionMode: 'manual_approval' | 'automatic_entry';
};

type FieldErrors = Partial<Record<keyof FormValues | 'locationPoint' | 'form', string>>;
type Props = Readonly<{
  eventId: string;
  activityOptions: readonly EventActivityType[];
  catalogAvailable: boolean;
  federativeUnits: readonly FederativeUnitOption[];
  locationCatalogAvailable: boolean;
  mapTileUrlTemplate: string;
  mapAttributionUrl: string;
}>;

const EMPTY: FormValues = {
  activityTypeCode: '', title: '', description: '', ufCode: '', municipalityCode: '', municipalityName: '',
  startsAtLocal: '', endsAtLocal: '', venueType: '', nonResidentialHostDeclaration: false,
  latitude: '', longitude: '', capacity: '', admissionMode: 'manual_approval',
};

function valuesFromDraft(draft: EventOwnerDraft): FormValues {
  return {
    activityTypeCode: draft.activityType?.code ?? '', title: draft.title ?? '', description: draft.description ?? '',
    ufCode: (draft.location?.ufCode as UfCode | undefined) ?? '', municipalityCode: draft.location?.municipalityCode ?? '',
    municipalityName: draft.location?.municipalityName ?? '', startsAtLocal: draft.startsAtLocal ?? '', endsAtLocal: draft.endsAtLocal ?? '',
    venueType: draft.venueType ?? '', nonResidentialHostDeclaration: draft.nonResidentialHostDeclaration ?? false,
    latitude: draft.exactLocation ? String(draft.exactLocation.latitude) : '', longitude: draft.exactLocation ? String(draft.exactLocation.longitude) : '',
    capacity: draft.capacity === null ? '' : String(draft.capacity), admissionMode: draft.admissionMode,
  };
}

function payloadFromValues(values: FormValues) {
  const exactLocation = values.latitude.trim() === '' && values.longitude.trim() === ''
    ? null
    : { latitude: Number(values.latitude), longitude: Number(values.longitude) };
  return {
    activityTypeCode: values.activityTypeCode || null,
    title: values.title.trim() || null,
    description: values.description.trim() || null,
    startsAtLocal: values.startsAtLocal || null,
    endsAtLocal: values.endsAtLocal || null,
    ufCode: values.ufCode || null,
    municipalityCode: values.municipalityCode || null,
    venueType: values.venueType || null,
    nonResidentialHostDeclaration: values.nonResidentialHostDeclaration ? true : null,
    exactLocation,
    capacity: values.capacity === '' ? null : Number(values.capacity),
    admissionMode: values.admissionMode,
  };
}

function isSame(a: FormValues, b: FormValues) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function messageFor(failure: EventApiFailure, operation: 'general' | 'publish' = 'general') {
  if (failure === 'expired') return 'Sua sessão terminou. Entre novamente para continuar.';
  if (failure === 'forbidden') return 'Esta ação não está disponível para sua conta agora.';
  if (failure === 'not_found') return 'Este rascunho não está disponível. Volte a encontros e tente novamente.';
  if (failure === 'conflict') return operation === 'publish'
    ? 'A publicação não foi concluída. O rascunho pode ter mudado ou um limite de encontros da anfitriã pode ter sido atingido. Confira as regras na tela e tente novamente.'
    : 'Outra alteração foi salva. Seu conteúdo continua nesta tela; você pode recarregar a versão remota quando quiser.';
  if (failure === 'invalid') return operation === 'publish'
    ? 'A publicação foi recusada. Confira os campos, os horários e os limites de anfitriã explicados nesta tela.'
    : 'Revise os campos destacados e tente novamente.';
  return 'Não conseguimos concluir agora. Tente novamente em instantes.';
}

function localDateLabel(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Horário a confirmar';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(date);
}

function publicationErrors(values: FormValues): FieldErrors {
  const nextErrors: FieldErrors = {};
  if (!values.activityTypeCode) nextErrors.activityTypeCode = 'Escolha o tipo de atividade.';
  if (!values.title.trim()) nextErrors.title = 'Informe o nome do encontro.';
  if (!values.description.trim()) nextErrors.description = 'Conte o que o grupo fará.';
  if (!values.ufCode) nextErrors.ufCode = 'Escolha o estado do encontro.';
  if (!values.municipalityCode) nextErrors.municipalityCode = 'Escolha o município do encontro.';
  if (!values.venueType) nextErrors.venueType = 'Escolha uma categoria de local público.';
  if (!values.nonResidentialHostDeclaration) nextErrors.nonResidentialHostDeclaration = 'Confirme que o encontro não acontecerá em uma residência.';
  const latitude = values.latitude.trim();
  const longitude = values.longitude.trim();
  if (!latitude && !longitude) {
    nextErrors.locationPoint = 'Busque um local público ou mova o pino no mapa para definir o ponto exato.';
    nextErrors.latitude = 'Defina a latitude escolhendo um local no mapa ou informando este campo.';
    nextErrors.longitude = 'Defina a longitude escolhendo um local no mapa ou informando este campo.';
  } else {
    if (!latitude) nextErrors.latitude = 'Informe a latitude do ponto exato.';
    else if (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90) nextErrors.latitude = 'Use uma latitude entre -90 e 90.';
    if (!longitude) nextErrors.longitude = 'Informe a longitude do ponto exato.';
    else if (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180) nextErrors.longitude = 'Use uma longitude entre -180 e 180.';
  }
  if (!values.startsAtLocal) nextErrors.startsAtLocal = 'Informe a data e a hora de início.';
  if (!values.capacity) nextErrors.capacity = 'Informe o total de pessoas, incluindo você.';
  else if (!Number.isInteger(Number(values.capacity)) || Number(values.capacity) < 1 || Number(values.capacity) > 12) nextErrors.capacity = 'Informe um total entre 1 e 12 pessoas.';
  if (values.startsAtLocal && values.endsAtLocal) {
    const start = Date.parse(`${values.startsAtLocal}:00Z`);
    const end = Date.parse(`${values.endsAtLocal}:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) nextErrors.endsAtLocal = 'O término deve ser posterior ao início.';
    else if (end - start > 8 * 60 * 60_000) nextErrors.endsAtLocal = 'A duração máxima do encontro é de 8 horas.';
  }
  return nextErrors;
}

export function EventForm({ eventId, activityOptions, catalogAvailable, federativeUnits, locationCatalogAvailable, mapTileUrlTemplate, mapAttributionUrl }: Props) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [savedValues, setSavedValues] = useState<FormValues>(EMPTY);
  const [draft, setDraft] = useState<EventOwnerDraft>();
  const [preview, setPreview] = useState<EventPreview>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [locationMapOpen, setLocationMapOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const previewDialogRef = useRef<HTMLDialogElement>(null);
  const publishDialogRef = useRef<HTMLDialogElement>(null);
  const dirty = !isSame(values, savedValues);
  const locationSavedInDraft = Boolean(draft?.location && draft.location.ufCode === values.ufCode && draft.location.municipalityCode === values.municipalityCode);
  const published = draft?.status === 'published_open' || draft?.status === 'full';
  const readOnly = draft !== undefined && draft.status !== 'draft';
  const activityChoices = useMemo(() => {
    const savedActivity = draft?.activityType;
    if (!savedActivity || activityOptions.some((item) => item.code === savedActivity.code)) return activityOptions;
    return [{ ...savedActivity, label: `${savedActivity.label} (indisponível)` }, ...activityOptions];
  }, [activityOptions, draft?.activityType]);
  const proposalFieldsFilled = [values.activityTypeCode, values.title.trim(), values.description.trim()].filter(Boolean).length;
  const hasMunicipality = Boolean(values.municipalityName && values.ufCode && values.municipalityCode);
  const hasExactLocation = Boolean(values.latitude.trim() && values.longitude.trim());
  const capacityNumber = Number(values.capacity);
  const hasValidCapacity = Number.isInteger(capacityNumber) && capacityNumber >= 1 && capacityNumber <= 12;
  const sectionStatuses: EventSectionNavStatuses = {
    'event-proposta': { text: proposalFieldsFilled === 3 ? 'Completa' : `${proposalFieldsFilled} de 3 itens`, pending: proposalFieldsFilled < 3 },
    'event-onde': {
      text: !hasMunicipality ? 'Escolha o município' : !values.venueType ? 'Escolha o tipo de local' : !values.nonResidentialHostDeclaration ? 'Confirme local público' : !hasExactLocation ? `${values.municipalityName} · defina o ponto` : `${values.municipalityName} · ${values.ufCode}`,
      pending: !(hasMunicipality && values.venueType && values.nonResidentialHostDeclaration && hasExactLocation),
    },
    'event-quando': { text: values.startsAtLocal ? 'Horário definido' : 'Defina data e hora', pending: !values.startsAtLocal },
    'event-vagas': { text: hasValidCapacity ? `${capacityNumber} pessoas · inclui você` : 'Defina o limite', pending: !hasValidCapacity },
    'event-entrada': { text: values.admissionMode === 'manual_approval' ? 'Aprovação manual' : 'Entrada automática', pending: false },
  };

  const loadDraft = useCallback(async (replaceLocal: boolean) => {
    const result = await readEventDraft(eventId);
    if (result.kind === 'ok') {
      const nextValues = valuesFromDraft(result.data);
      setDraft(result.data);
      try { saveEventDraftReference(window.sessionStorage, result.data.id); } catch { /* The identified route remains usable. */ }
      if (replaceLocal) {
        setValues(nextValues);
        setSavedValues(nextValues);
        setConflict(false);
        setLocationMapOpen(false);
      }
      setErrors({});
      setStatus(replaceLocal ? 'Rascunho carregado.' : 'Versão remota consultada.');
    } else {
      setErrors({ form: String(messageFor(result.kind)) });
      if (result.kind === 'conflict') setConflict(true);
    }
    setPending(false);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { queueMicrotask(() => { void loadDraft(true); }); }, [loadDraft]);
  useEffect(() => {
    if (preview) previewDialogRef.current?.showModal();
    else if (previewDialogRef.current?.open) previewDialogRef.current.close();
  }, [preview]);
  useEffect(() => {
    if (publishOpen) publishDialogRef.current?.showModal();
    else if (publishDialogRef.current?.open) publishDialogRef.current.close();
  }, [publishOpen]);
  useEffect(() => {
    if (Object.values(errors).some(Boolean)) summaryRef.current?.focus();
  }, [errors]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    if (key === 'latitude' || key === 'longitude') setLocationMapOpen(false);
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, ...((key === 'latitude' || key === 'longitude') ? { locationPoint: undefined } : {}), form: undefined }));
    setStatus('');
    setConflict(false);
  }

  function buildUpdate() {
    const payload = payloadFromValues(values);
    const parsed = updateEventDraftRequestSchema.safeParse({ ...payload, revision: draft?.revision });
    const nextErrors: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'exactLocation' ? issue.path[1] : issue.path[0];
        if (key === 'latitude' || key === 'longitude' || key in EMPTY) nextErrors[key as keyof FormValues] = 'Confira este campo.';
      }
    }
    if ((values.latitude.trim() !== '') !== (values.longitude.trim() !== '')) nextErrors.form = 'Informe latitude e longitude juntas, ou deixe as duas em branco.';
    if ((values.ufCode === '') !== (values.municipalityCode === '')) nextErrors.form = 'Escolha o estado e o município para salvar a localização.';
    if ((values.startsAtLocal || values.endsAtLocal) && !values.municipalityCode) nextErrors.startsAtLocal = 'Escolha primeiro o município para definir o fuso horário.';
    if (values.endsAtLocal && !values.startsAtLocal) nextErrors.endsAtLocal = 'Informe o início antes do término.';
    if (Object.keys(nextErrors).length || !parsed.success || !draft) {
      if (!draft) nextErrors.form = 'O rascunho ainda está carregando.';
      setErrors(nextErrors);
      return undefined;
    }
    return parsed.data;
  }

  async function persist() {
    const input = buildUpdate();
    if (!input || !draft) return undefined;
    setPending(true);
    setErrors({});
    const result = await saveEventDraft(eventId, input);
    setPending(false);
    if (result.kind !== 'ok') {
      setErrors({ form: String(messageFor(result.kind)) });
      if (result.kind === 'conflict') setConflict(true);
      return undefined;
    }
    const nextValues = valuesFromDraft(result.data);
    setDraft(result.data);
    setValues(nextValues);
    setSavedValues(nextValues);
    try { saveEventDraftReference(window.sessionStorage, result.data.id); } catch { /* The identified route remains usable. */ }
    setStatus('Rascunho salvo. Você pode voltar a esta sessão para continuar.');
    return result.data;
  }

  async function openLocationMap() {
    if (pending || readOnly || !draft || !values.ufCode || !values.municipalityCode || !mapTileUrlTemplate) return;
    if (locationSavedInDraft) {
      setLocationMapOpen(true);
      return;
    }

    setPending(true);
    setErrors({});
    const result = await saveEventDraft(eventId, {
      ufCode: values.ufCode,
      municipalityCode: values.municipalityCode,
      revision: draft.revision,
    });
    setPending(false);
    if (result.kind !== 'ok') {
      setErrors({ form: String(messageFor(result.kind)) });
      if (result.kind === 'conflict') setConflict(true);
      return;
    }

    const savedLocation = valuesFromDraft(result.data);
    setDraft(result.data);
    setSavedValues((current) => ({
      ...current,
      ufCode: savedLocation.ufCode,
      municipalityCode: savedLocation.municipalityCode,
      municipalityName: savedLocation.municipalityName,
      latitude: savedLocation.latitude,
      longitude: savedLocation.longitude,
    }));
    setLocationMapOpen(true);
    setStatus('Cidade salva para a busca. As outras mudanças continuam neste formulário até você salvar o rascunho.');
  }

  async function save() {
    if (pending || readOnly) return;
    await persist();
  }

  async function openPreview() {
    if (pending || readOnly) return;
    const current = dirty ? await persist() : draft;
    if (!current) return;
    setPending(true);
    const result = await previewEventDraft(eventId);
    setPending(false);
    if (result.kind !== 'ok') {
      setErrors({ form: String(messageFor(result.kind)) });
      if (result.kind === 'conflict') setConflict(true);
      return;
    }
    const safePreview = eventPreviewSchema.safeParse(result.data);
    if (!safePreview.success) {
      setErrors({ form: 'A prévia não está disponível no momento.' });
      return;
    }
    setPreview(safePreview.data);
  }

  async function beginPublish() {
    if (pending || readOnly) return;
    const publicationIssues = publicationErrors(values);
    if (Object.values(publicationIssues).some(Boolean)) {
      setErrors(publicationIssues);
      setStatus('');
      return;
    }
    const current = dirty ? await persist() : draft;
    if (!current) return;
    setPublishOpen(true);
  }

  async function confirmPublish() {
    if (!draft || pending) return;
    setPending(true);
    setErrors({});
    const latest = await readEventDraft(eventId);
    if (latest.kind !== 'ok') {
      setPending(false);
      setErrors({ form: String(messageFor(latest.kind)) });
      if (latest.kind === 'conflict') setConflict(true);
      setPublishOpen(false);
      return;
    }
    if (latest.data.revision !== draft.revision) {
      setPending(false);
      setConflict(true);
      setPublishOpen(false);
      setErrors({ form: 'O rascunho mudou desde a última leitura. Seu conteúdo continua nesta tela; recarregue a versão remota antes de publicar.' });
      return;
    }
    const result = await publishEventDraft(eventId, latest.data.revision);
    setPending(false);
    setPublishOpen(false);
    if (result.kind !== 'ok') {
      setErrors({ form: String(messageFor(result.kind, 'publish')) });
      if (result.kind === 'conflict') setConflict(true);
      return;
    }
    const nextValues = valuesFromDraft(result.data);
    setDraft(result.data);
    setValues(nextValues);
    setSavedValues(nextValues);
    setStatus('Encontro publicado.');
  }

  const inputClass = (key: keyof FormValues) => `block min-h-12 w-full rounded-xl border-2 ${errors[key] ? 'border-error focus-visible:border-error' : 'border-border hover:border-muted-foreground focus-visible:border-foreground'} bg-surface px-4 text-base text-foreground placeholder:text-disabled focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:text-disabled`;
  const fieldClass = 'block space-y-2';
  const labelClass = 'block font-semibold';
  const errorFor = (key: keyof FormValues | 'locationPoint') => errors[key] ? <p id={'event-' + key + '-error'} className="flex items-start gap-2 text-sm font-semibold text-error"><span aria-hidden="true" className="mt-0.5 font-black">!</span><span>{errors[key]}</span></p> : null;
  const invalidProps = (key: keyof FormValues) => errors[key] ? { 'aria-invalid': true as const, 'aria-describedby': 'event-' + key + '-error', 'aria-errormessage': 'event-' + key + '-error' } : {};
  const errorAnchor = (key: string) => key === 'ufCode' || key === 'municipalityCode' ? 'location' : key === 'latitude' || key === 'longitude' ? key : key === 'locationPoint' ? 'location-point' : key;

  if (loading) return <div role="status" className="max-w-2xl rounded-2xl border-2 border-border bg-card p-6 text-muted-foreground">Abrindo seu rascunho…</div>;
  if (!draft && errors.form) return <div className="max-w-2xl space-y-5"><Notice tone="warning" title="Rascunho indisponível.">{errors.form}</Notice><Link href="/eventos" className="font-semibold text-foreground underline underline-offset-4">Voltar a encontros</Link></div>;

  return (
    <div className="grid gap-8 pb-36 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-12 lg:pb-20">
      <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
        <EventSectionNav statuses={sectionStatuses} />
        {!readOnly ? <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8 lg:static lg:mt-8 lg:flex lg:flex-col lg:gap-3 lg:border-t-0 lg:bg-transparent lg:p-0">
          <p aria-live="polite" className={`mb-2 text-center text-xs font-semibold lg:mb-0 lg:text-left ${dirty ? 'text-warning' : 'text-muted-foreground'}`}>{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</p>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <Button type="button" wide pending={pending} pendingLabel="Salvando…" onClick={() => void save()} className="min-w-0! px-2! text-xs! sm:text-sm! lg:min-h-12! lg:text-base!">Salvar rascunho</Button>
            <Button type="button" variant="secondary" wide disabled={pending} onClick={() => void openPreview()} className="min-w-0! px-2! text-xs! sm:text-sm! lg:text-base!">Ver prévia</Button>
            <Button type="button" variant="secondary" wide disabled={pending} onClick={() => void beginPublish()} className="min-w-0! px-2! text-xs! sm:text-sm! lg:text-base!">Publicar</Button>
          </div>
        </div> : null}
      </aside>
      <div className="min-w-0 space-y-8">
        <header className="max-w-3xl space-y-3">
          <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] poster-stretch sm:text-5xl">Prepare seu <span className="text-primary">convite.</span></h1>
          <p className="max-w-[62ch] text-base leading-relaxed text-muted-foreground">Preencha o que já sabe e salve quando quiser. Publicar é uma etapa separada; o ponto exato não aparece na prévia.</p>
        </header>

        {Object.values(errors).some(Boolean) ? <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="event-error-title" className="rounded-2xl border-2 border-error bg-card p-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning"><h2 id="event-error-title" className="font-bold">{Object.entries(errors).some(([key, message]) => key !== 'form' && Boolean(message)) ? 'Corrija os campos destacados para publicar.' : 'Não foi possível continuar.'}</h2>{errors.form ? <p className="mt-1 text-sm leading-relaxed">{errors.form}{errors.form.startsWith('Sua sessão terminou') ? <> <Link href="/entrar" className="font-semibold underline underline-offset-4">Entrar</Link></> : null}</p> : null}{Object.entries(errors).filter(([key, message]) => key !== 'form' && Boolean(message)).length ? <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">{Object.entries(errors).filter(([key, message]) => key !== 'form' && Boolean(message)).map(([key, message]) => <li key={key}><a className="underline decoration-error underline-offset-4" href={'#event-field-' + errorAnchor(key)}>{message}</a></li>)}</ul> : null}{conflict ? <button type="button" className="mt-3 min-h-11 font-semibold text-foreground underline underline-offset-4" onClick={() => { setPending(true); setErrors({}); void loadDraft(true); }}>Recarregar versão remota</button> : null}</div> : null}
        {catalogAvailable ? null : <Notice tone="warning" title="Tipos de atividade temporariamente indisponíveis.">Você pode continuar preenchendo as outras partes e tentar selecionar uma atividade mais tarde.</Notice>}
        {locationCatalogAvailable ? null : <Notice tone="warning" title="Catálogo de estados indisponível.">Tente novamente mais tarde para escolher o local e definir o fuso do encontro.</Notice>}
        {published ? <Notice tone="success" title="Este encontro já foi publicado.">Você pode consultar o convite e compartilhar o link quando essa etapa estiver disponível.</Notice> : readOnly ? <Notice tone="warning" title="Este encontro não está mais em edição.">O estado atual não permite alterar ou publicar este rascunho.</Notice> : null}

        <section id="event-proposta" aria-labelledby="event-proposta-title" className="scroll-mt-6 space-y-5 border-b-2 border-border pb-8">
          <div><p className="text-sm font-bold uppercase tracking-[0.12em] text-primary-hover">01</p><h2 id="event-proposta-title" className="mt-1 text-2xl font-bold">A proposta</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Dê um nome e explique em poucas linhas o que o grupo fará.</p></div>
          <label id="event-field-activityTypeCode" className={fieldClass}><span className={labelClass}>Tipo de atividade</span><select className={inputClass('activityTypeCode')} value={values.activityTypeCode} disabled={readOnly || !catalogAvailable} onChange={(event) => update('activityTypeCode', event.target.value)} {...invalidProps('activityTypeCode')}><option value="">Escolha uma atividade</option>{activityChoices.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select>{errorFor('activityTypeCode')}</label>
          <label id="event-field-title" className={fieldClass}><span className={labelClass}>Nome do encontro</span><input className={inputClass('title')} maxLength={120} value={values.title} disabled={readOnly} onChange={(event) => update('title', event.target.value)} placeholder="Ex.: Caminhada leve no parque" {...invalidProps('title')} />{errorFor('title')}<span className="text-sm text-muted-foreground">Até 120 caracteres.</span></label>
          <label id="event-field-description" className={fieldClass}><span className={labelClass}>Sobre o encontro</span><textarea className={inputClass('description') + ' min-h-36 resize-y py-3 leading-relaxed'} maxLength={2000} value={values.description} disabled={readOnly} onChange={(event) => update('description', event.target.value)} placeholder="Conte o que as pessoas podem esperar e o que é bom levar." {...invalidProps('description')} />{errorFor('description')}<span className="text-sm text-muted-foreground">Até 2.000 caracteres.</span></label>
        </section>

        <section id="event-onde" aria-labelledby="event-onde-title" className="scroll-mt-6 space-y-5 border-b-2 border-border pb-8">
          <div><p className="text-sm font-bold uppercase tracking-[0.12em] text-primary-hover">02</p><h2 id="event-onde-title" className="mt-1 text-2xl font-bold">Onde vai acontecer</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">O município define o fuso horário. Não informe endereço residencial.</p></div>
          <div id="event-field-location"><LocationField key={draft?.revision ?? 0} federativeUnits={federativeUnits} legend="Cidade do encontro" helpText="Escolha o estado e o município. Não pedimos endereço, bairro, CEP nem localização do aparelho." initialUfCode={values.ufCode || undefined} initialMunicipalityCode={values.municipalityCode} initialMunicipalityName={values.municipalityName} disabled={readOnly || pending || !locationCatalogAvailable} error={errors.ufCode || errors.municipalityCode} onChange={(location) => {
            const changed = location.ufCode !== values.ufCode || location.municipalityCode !== values.municipalityCode;
            if (changed) setLocationMapOpen(false);
            setValues((current) => ({ ...current, ufCode: location.ufCode, municipalityCode: location.municipalityCode, municipalityName: location.municipalityName, ...(changed ? { latitude: '', longitude: '' } : {}) }));
            setErrors((current) => ({ ...current, ufCode: undefined, municipalityCode: undefined, latitude: undefined, longitude: undefined, locationPoint: undefined, startsAtLocal: undefined, form: undefined }));
            setStatus('');
          }} /></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label id="event-field-venueType" className={fieldClass}><span className={labelClass}>Categoria de local</span><select className={inputClass('venueType')} value={values.venueType} disabled={readOnly} onChange={(event) => update('venueType', event.target.value as FormValues['venueType'])} {...invalidProps('venueType')}><option value="">Escolha uma categoria</option><option value="public_place">Espaço público</option><option value="identifiable_establishment">Estabelecimento identificável</option></select>{errorFor('venueType')}</label>
            <div className="space-y-2"><span className={labelClass}>Confirmação do local</span><label id="event-field-nonResidentialHostDeclaration" className={`flex min-h-12 items-start gap-3 rounded-xl border-2 ${errors.nonResidentialHostDeclaration ? 'border-error' : 'border-border'} bg-surface p-3`}><input type="checkbox" className="mt-1 size-5 accent-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning" checked={values.nonResidentialHostDeclaration} disabled={readOnly} onChange={(event) => update('nonResidentialHostDeclaration', event.target.checked)} {...invalidProps('nonResidentialHostDeclaration')} /><span className="text-sm leading-relaxed">Confirmo que o encontro não acontecerá em uma residência.</span></label>{errorFor('nonResidentialHostDeclaration')}</div>
          </div>
          <fieldset className={`space-y-4 rounded-2xl border-2 ${errors.latitude || errors.longitude || errors.locationPoint ? 'border-error' : 'border-border'} bg-card p-4 sm:p-5`}><legend className="px-2 font-semibold">Ponto exato, apenas para organização</legend><p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">O ponto exato é privado e não aparece no convite nem na prévia. Busque um local público e mova o pino; não pedimos localização do aparelho.</p><p className="max-w-[68ch] rounded-xl border border-border bg-surface p-3 text-sm leading-relaxed text-foreground"><span className="font-semibold">Sobre o mapa:</span> ao abrir, o serviço público recebe o município. A busca envia o nome digitado; os mapas podem receber seu IP e a área exibida.</p>
            <div id="event-field-location-point" className="space-y-3" aria-invalid={errors.locationPoint || errors.latitude || errors.longitude ? true : undefined} aria-describedby={errors.locationPoint ? (locationMapOpen ? 'event-location-point-error' : 'event-locationPoint-error') : undefined}>
              {locationMapOpen && locationSavedInDraft
                ? <EventLocationPicker key={`${values.ufCode}:${values.municipalityCode}`} eventId={eventId} tileUrlTemplate={mapTileUrlTemplate} attributionUrl={mapAttributionUrl} latitude={values.latitude} longitude={values.longitude} disabled={readOnly || !mapTileUrlTemplate} error={errors.locationPoint || errors.latitude || errors.longitude} onClose={() => setLocationMapOpen(false)} onPick={(point: MapPoint | null) => {
                  setValues((current) => ({ ...current, latitude: point ? String(point.latitude) : '', longitude: point ? String(point.longitude) : '' }));
                  setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined, locationPoint: undefined, form: undefined }));
                  setStatus('');
                }} />
                : <div className="space-y-2">{values.municipalityCode && !locationSavedInDraft ? <p className="text-sm leading-relaxed text-muted-foreground">Salve a cidade escolhida para centralizar o mapa e limitar a busca a esse município. As outras mudanças do formulário não serão salvas agora.</p> : null}<Button type="button" variant="secondary" disabled={readOnly || pending || !values.municipalityCode || !mapTileUrlTemplate} onClick={() => void openLocationMap()} pending={pending} pendingLabel={locationSavedInDraft ? 'Abrindo mapa…' : 'Salvando cidade…'}>{locationSavedInDraft ? 'Abrir mapa e buscar local' : 'Salvar cidade e abrir mapa'}</Button>{errorFor('locationPoint')}{!values.municipalityCode ? <p className="text-sm text-muted-foreground">Escolha primeiro estado e município.</p> : null}</div>}
            </div>
            <details open={Boolean(errors.latitude || errors.longitude) || undefined} className="rounded-xl border-2 border-border bg-surface p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning">Informar coordenadas manualmente</summary><p className="mb-4 text-sm text-muted-foreground">Use esta opção se já tiver as coordenadas do local público.</p><div className="grid gap-4 sm:grid-cols-2"><label id="event-field-latitude" className={fieldClass}><span className={labelClass}>Latitude</span><input className={inputClass('latitude')} inputMode="decimal" type="number" min={-90} max={90} step="any" value={values.latitude} disabled={readOnly} onChange={(event) => update('latitude', event.target.value)} placeholder="Ex.: -23.5505" {...invalidProps('latitude')} />{errorFor('latitude')}</label><label id="event-field-longitude" className={fieldClass}><span className={labelClass}>Longitude</span><input className={inputClass('longitude')} inputMode="decimal" type="number" min={-180} max={180} step="any" value={values.longitude} disabled={readOnly} onChange={(event) => update('longitude', event.target.value)} placeholder="Ex.: -46.6333" {...invalidProps('longitude')} />{errorFor('longitude')}</label></div></details>
          </fieldset>
        </section>

        <section id="event-quando" aria-labelledby="event-quando-title" className="scroll-mt-6 space-y-5 border-b-2 border-border pb-8">
          <div><p className="text-sm font-bold uppercase tracking-[0.12em] text-primary-hover">03</p><h2 id="event-quando-title" className="mt-1 text-2xl font-bold">Quando acontece</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Informe horários locais. O início deve ocorrer entre 24 horas e 30 dias a partir de agora. Se informar o término, a duração máxima é de 8 horas.</p>{draft?.timeZone ? <p className="mt-2 text-sm font-semibold text-foreground">Fuso deste rascunho: {draft.timeZone}</p> : null}</div>
          <div className="grid gap-5 sm:grid-cols-2"><label id="event-field-startsAtLocal" className={fieldClass}><span className={labelClass}>Início (data e hora)</span><input className={inputClass('startsAtLocal')} type="datetime-local" step="60" value={values.startsAtLocal} disabled={readOnly} onChange={(event) => update('startsAtLocal', event.target.value)} {...invalidProps('startsAtLocal')} />{errorFor('startsAtLocal')}</label><label id="event-field-endsAtLocal" className={fieldClass}><span className={labelClass}>Término (opcional)</span><input className={inputClass('endsAtLocal')} type="datetime-local" step="60" value={values.endsAtLocal} disabled={readOnly} onChange={(event) => update('endsAtLocal', event.target.value)} {...invalidProps('endsAtLocal')} />{errorFor('endsAtLocal')}</label></div>
        </section>

        <section id="event-vagas" aria-labelledby="event-vagas-title" className="scroll-mt-6 space-y-5 border-b-2 border-border pb-8">
          <div><p className="text-sm font-bold uppercase tracking-[0.12em] text-primary-hover">04</p><h2 id="event-vagas-title" className="mt-1 text-2xl font-bold">Vagas</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">O limite inclui você como anfitriã.</p></div>
          <label id="event-field-capacity" className={fieldClass}><span className={labelClass}>Total de pessoas</span><input className={inputClass('capacity') + ' max-w-48'} type="number" min={1} max={12} step={1} value={values.capacity} disabled={readOnly} onChange={(event) => update('capacity', event.target.value)} placeholder="1 a 12" {...invalidProps('capacity')} />{errorFor('capacity')}</label>
        </section>

        <section id="event-entrada" aria-labelledby="event-entrada-title" className="scroll-mt-6 space-y-5 border-b-2 border-border pb-8">
          <div><p className="text-sm font-bold uppercase tracking-[0.12em] text-primary-hover">05</p><h2 id="event-entrada-title" className="mt-1 text-2xl font-bold">Como entram</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Você pode revisar o convite antes de publicar.</p></div>
          <fieldset className="space-y-3"><legend className="font-semibold">Aprovação de participantes</legend><label className="flex min-h-12 items-start gap-3 rounded-xl border-2 border-border bg-surface p-3"><input type="radio" name="admissionMode" className="mt-1 size-5 accent-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning" checked={values.admissionMode === 'manual_approval'} disabled={readOnly} onChange={() => update('admissionMode', 'manual_approval')} /><span><strong className="block">Aprovar cada pedido</strong><span className="text-sm text-muted-foreground">Você decide quem participa.</span></span></label><label className="flex min-h-12 items-start gap-3 rounded-xl border-2 border-border bg-surface p-3"><input type="radio" name="admissionMode" className="mt-1 size-5 accent-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning" checked={values.admissionMode === 'automatic_entry'} disabled={readOnly} onChange={() => update('admissionMode', 'automatic_entry')} /><span><strong className="block">Entrada automática</strong><span className="text-sm text-muted-foreground">Pedidos entram enquanto houver vagas.</span></span></label></fieldset>
        </section>

        <div className="rounded-2xl border-2 border-border bg-card p-4 sm:p-5"><p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">Todas as anfitriãs podem manter no máximo um encontro futuro ativo e publicar até dois encontros em uma janela móvel de 30 dias. Ainda não há categoria paga com limite diferente.</p></div>

        <div role="status" aria-live="polite" className="min-h-6 text-sm font-semibold text-foreground">{status}</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link className="inline-flex min-h-12 items-center justify-center px-4 font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning" href="/eventos">Voltar a encontros</Link>
        </div>
        {dirty && !readOnly ? <p className="text-sm text-muted-foreground">Há mudanças ainda não salvas.</p> : null}
      </div>

      <dialog ref={previewDialogRef} aria-labelledby="event-preview-title" onClose={() => setPreview(undefined)} className="fixed inset-4 m-auto w-[min(42rem,calc(100vw_-_2rem))] max-h-[calc(100dvh_-_2rem)] max-w-full overflow-y-auto overscroll-contain rounded-2xl border-2 border-border bg-background p-0 text-foreground backdrop:bg-background/80">
        {preview ? <div className="space-y-5 p-5 sm:p-8"><div className="flex items-start justify-between gap-4"><h2 id="event-preview-title" className="font-display text-3xl font-black uppercase leading-tight poster-stretch">{preview.title}</h2><button type="button" aria-label="Fechar prévia" className="grid min-h-11 min-w-11 place-items-center rounded-full border-2 border-border hover:border-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning" onClick={() => setPreview(undefined)}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg></button></div><p className="text-sm font-semibold text-primary-hover">{preview.activityType.label}</p><p className="whitespace-pre-wrap leading-relaxed">{preview.description}</p><dl className="grid gap-4 border-y-2 border-border py-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Quando</dt><dd className="font-semibold">{localDateLabel(preview.startsAt, preview.timeZone)}</dd>{preview.endsAt ? <dd className="text-sm text-muted-foreground">Até {localDateLabel(preview.endsAt, preview.timeZone)}</dd> : null}</div><div><dt className="text-sm text-muted-foreground">Onde</dt><dd className="font-semibold">{preview.location.municipalityName} · {preview.location.ufCode}</dd><dd className="text-sm text-muted-foreground">A área exibida é aproximada; o ponto exato permanece privado.</dd></div><div><dt className="text-sm text-muted-foreground">Participantes / vagas</dt><dd className="text-2xl font-black tabular-nums">0/{preview.capacity}</dd><dd className="text-sm text-muted-foreground">Confirmados / limite total, incluindo a anfitriã.</dd></div><div><dt className="text-sm text-muted-foreground">Entrada</dt><dd className="font-semibold">{preview.admissionMode === 'manual_approval' ? 'Com aprovação da anfitriã' : 'Automática enquanto houver vagas'}</dd></div></dl><section aria-labelledby="event-preview-area-title" className="space-y-2"><h3 id="event-preview-area-title" className="font-bold">Área aproximada do encontro · raio de {preview.location.approximateArea.radiusMeters} m</h3><p className="text-sm text-muted-foreground">A marca mostra uma região estimada, não o ponto exato.</p><ApproximateAreaMap center={{ latitude: preview.location.approximateArea.latitude, longitude: preview.location.approximateArea.longitude }} radiusMeters={preview.location.approximateArea.radiusMeters} tileUrlTemplate={mapTileUrlTemplate} attributionUrl={mapAttributionUrl} /></section><div className="flex justify-end"><Button type="button" onClick={() => setPreview(undefined)}>Voltar ao rascunho</Button></div></div> : null}
      </dialog>

      <dialog ref={publishDialogRef} aria-labelledby="event-publish-title" onClose={() => setPublishOpen(false)} className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh_-_2rem)] w-[min(34rem,calc(100vw_-_2rem))] max-w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border-2 border-border bg-background p-5 text-foreground backdrop:bg-background/80 sm:p-7">
        <h2 id="event-publish-title" className="font-display text-2xl font-black uppercase poster-stretch">Publicar este encontro?</h2><p className="mt-3 leading-relaxed text-muted-foreground">O convite ficará disponível para outras pessoas. Confira as regras antes de confirmar.</p><div className="mt-4 space-y-3 rounded-xl border-2 border-border bg-card p-4 text-sm leading-relaxed"><p><strong>Horário:</strong> o início deve estar entre 24 horas e 30 dias no futuro. Se houver término, o encontro pode durar até 8 horas.</p><p><strong>Limite por anfitriã:</strong> no MVP, qualquer anfitriã pode manter no máximo um encontro futuro ativo e publicar até dois em uma janela móvel de 30 dias. Ainda não há categoria paga com limite diferente.</p></div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setPublishOpen(false)}>Continuar editando</Button><Button type="button" onClick={() => void confirmPublish()} pending={pending} pendingLabel="Publicando…">Confirmar publicação</Button></div>
      </dialog>
    </div>
  );
}
