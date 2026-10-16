'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/server/ui/button';
import { searchEventLocations, type EventApiFailure } from '@/features/events/api';
import type { EventLocationSearchResult } from '@/features/events/contracts';
import { approximateAreaZoom, OpenStreetMapView, type MapPoint } from './open-street-map';

const BRAZIL_OVERVIEW: MapPoint = { latitude: -14.235, longitude: -51.9253 };

type Props = Readonly<{
  eventId: string;
  tileUrlTemplate: string;
  attributionUrl: string;
  latitude: string;
  longitude: string;
  error?: string;
  disabled?: boolean;
  onPick: (point: MapPoint | null) => void;
  onClose: () => void;
}>;

function failureMessage(failure: EventApiFailure) {
  if (failure === 'rate_limited') return 'A busca está em espera para respeitar o limite do OpenStreetMap. Aguarde um instante e tente de novo.';
  if (failure === 'invalid') return 'Revise o nome do local e tente novamente.';
  if (failure === 'expired') return 'Sua sessão terminou. Entre novamente para continuar.';
  if (failure === 'forbidden') return 'Esta busca não está disponível para sua conta agora.';
  if (failure === 'not_found') return 'Este rascunho não está disponível. Volte a encontros e tente novamente.';
  return 'Não conseguimos acessar a busca por nome agora. Tente outra vez; o mapa continua disponível para mover o pino.';
}

function splitPlaceLabel(label: string): Readonly<{ name: string; address?: string }> {
  const separator = ' — ';
  const separatorIndex = label.indexOf(separator);
  if (separatorIndex < 0) return { name: label };
  return { name: label.slice(0, separatorIndex), address: label.slice(separatorIndex + separator.length) };
}

export function EventLocationPicker({ eventId, tileUrlTemplate, attributionUrl, latitude, longitude, error, disabled = false, onPick, onClose }: Props) {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const hasSelection = latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(parsedLatitude) && parsedLatitude >= -90 && parsedLatitude <= 90 && Number.isFinite(parsedLongitude) && parsedLongitude >= -180 && parsedLongitude <= 180;
  const selectedPoint = hasSelection ? { latitude: parsedLatitude, longitude: parsedLongitude } : undefined;
  const hasSelectedPoint = Boolean(selectedPoint);
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<MapPoint>(selectedPoint ?? BRAZIL_OVERVIEW);
  const [zoom, setZoom] = useState(hasSelectedPoint ? 15 : 3);
  const [returnPoint, setReturnPoint] = useState<MapPoint | undefined>(selectedPoint);
  const [returnZoom, setReturnZoom] = useState(hasSelectedPoint ? 15 : 3);
  const pointSelected = Boolean(selectedPoint && Math.abs(selectedPoint.latitude - center.latitude) < 0.000001 && Math.abs(selectedPoint.longitude - center.longitude) < 0.000001);
  const [searchedPlace, setSearchedPlace] = useState<Readonly<{ point: MapPoint; label: string }> | null>(null);
  const [results, setResults] = useState<readonly EventLocationSearchResult[]>([]);
  const [centering, setCentering] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState(!hasSelectedPoint && !disabled ? 'Abrindo o mapa enquanto localizamos o município…' : '');
  const [expanded, setExpanded] = useState(false);
  const initialSearchPromise = useRef<ReturnType<typeof searchEventLocations> | null>(null);
  const mounted = useRef(false);
  const userMovedMap = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRootRef = useRef<HTMLDivElement>(null);
  const wasExpanded = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (initialSearchPromise.current || hasSelectedPoint || disabled) return;
    initialSearchPromise.current = searchEventLocations(eventId, '');
    setCentering(true);
    void initialSearchPromise.current.then((result) => {
      if (!mounted.current) return;
      setCentering(false);
      if (result.kind !== 'ok') {
        setStatus(`${failureMessage(result.kind)} O mapa segue aberto numa visão geral do Brasil; aproxime e mova o pino até o local.`);
        return;
      }
      const municipality = result.data.results.find((item) => item.kind === 'municipality');
      if (municipality) {
        if (userMovedMap.current) {
          setStatus(`Localizamos ${municipality.label} e mantivemos o mapa no ponto que você já ajustou.`);
        } else {
          setCenter({ latitude: municipality.latitude, longitude: municipality.longitude });
          setZoom(15);
          setStatus(`Mapa centralizado em ${municipality.label}.`);
        }
      } else {
        setStatus('Não conseguimos localizar o município. O mapa segue aberto numa visão geral do Brasil; aproxime e mova o pino até o local.');
      }
    });
  }, [disabled, eventId, hasSelectedPoint]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (expanded && dialog && !dialog.open) dialog.showModal();
  }, [expanded]);

  useEffect(() => {
    if (wasExpanded.current && !expanded) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      pickerRootRef.current?.closest('fieldset')?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
      expandButtonRef.current?.focus({ preventScroll: true });
    }
    wasExpanded.current = expanded;
  }, [expanded]);

  function moveMap(point: MapPoint) {
    userMovedMap.current = true;
    setCenter(point);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (centering || searching || disabled || query.trim().length < 2) return;
    setSearching(true);
    setStatus('Buscando no OpenStreetMap…');
    const result = await searchEventLocations(eventId, query.trim());
    setSearching(false);
    if (result.kind !== 'ok') {
      setResults([]);
      setStatus(failureMessage(result.kind));
      return;
    }
    setResults(result.data.results.filter((item) => item.kind === 'place'));
    setStatus(result.data.results.length ? 'Escolha um local para posicionar o pino.' : 'Nenhum local encontrado nesse município. Tente outro nome ou ajuste o pino no mapa.');
  }

  function choose(result: EventLocationSearchResult) {
    const point = { latitude: result.latitude, longitude: result.longitude };
    setSearchedPlace({ point, label: splitPlaceLabel(result.label).name });
    setReturnPoint(point);
    setReturnZoom(15);
    userMovedMap.current = true;
    setCenter(point);
    setZoom(15);
  }

  function useCenter() {
    if (!center || disabled) return;
    userMovedMap.current = true;
    setReturnPoint(center);
    setReturnZoom(zoom);
    onPick(center);
    setStatus('');
    closeExpandedMap();
  }

  function returnToPoint() {
    if (!returnPoint || disabled) return;
    userMovedMap.current = true;
    setCenter(returnPoint);
    setZoom(returnZoom);
  }

  function clearPoint() {
    if (disabled || (!hasSelectedPoint && !searchedPlace)) return;
    if (hasSelectedPoint) onPick(null);
    setSearchedPlace(null);
    setReturnPoint(undefined);
    setStatus('');
  }

  function closeExpandedMap() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else setExpanded(false);
  }

  const errorId = 'event-location-point-error';
  const statusId = 'event-location-search-status';
  const searchForm = (
    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void search(event)}>
      <label className="min-w-0 flex-1 space-y-2">
        <span className="block font-semibold">Nome do local</span>
        <input className="block min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 text-base text-foreground placeholder:text-disabled focus-visible:border-foreground focus-visible:outline-offset-3" value={query} maxLength={80} disabled={disabled || searching} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Parque da Jaqueira" />
      </label>
      <div className="flex items-end"><Button type="submit" variant="secondary" disabled={disabled || centering || searching || query.trim().length < 2} pending={searching} pendingLabel="Buscando…">Buscar local</Button></div>
    </form>
  );
  const searchResults = results.length ? (
    <ul className="space-y-2" aria-label="Resultados da busca de locais">
      {results.map((result) => {
        const place = splitPlaceLabel(result.label);
        return <li key={`${result.label}-${result.latitude}-${result.longitude}`}><button type="button" disabled={disabled} onClick={() => choose(result)} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border-2 border-border bg-surface px-4 py-3 text-left hover:border-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning"><span className="min-w-0 flex-1"><span className="block font-semibold leading-snug text-foreground">{place.name}</span>{place.address ? <span className="mt-1 block text-sm font-normal leading-snug text-muted-foreground">{place.address}</span> : null}</span><span className="shrink-0 pt-0.5 text-sm font-semibold text-primary-hover">Mover pino</span></button></li>;
      })}
    </ul>
  ) : null;
  const mapControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" disabled={disabled} onClick={useCenter}>Usar esse ponto</Button>
      <Button type="button" variant="secondary" disabled={disabled || (!hasSelectedPoint && !searchedPlace)} onClick={clearPoint}>Desmarcar ponto</Button>
    </div>
  );
  const feedback = (
    <>
      {error ? <p id={errorId} role="alert" className="flex items-start gap-2 text-sm font-semibold text-error"><span aria-hidden="true" className="mt-0.5 font-black">!</span><span>{error}</span></p> : null}
      <p id={statusId} role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-foreground">{centering ? 'Localizando o município; o mapa já está aberto…' : status}</p>
    </>
  );
  return (
    <div ref={pickerRootRef} className="space-y-4 scroll-mt-8" aria-invalid={error ? true : undefined} aria-describedby={[error ? errorId : undefined, statusId].filter(Boolean).join(' ')}>
      {!expanded ? <>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">Busque pelo nome de um lugar público ou estabelecimento. Não pesquise endereço residencial.</p>
        {searchForm}
        {searchResults}
        <div className="space-y-3">
          <OpenStreetMapView center={center} zoom={zoom} tileUrlTemplate={tileUrlTemplate} attributionUrl={attributionUrl} interactive pointSelected={pointSelected} searchedPlacePoint={searchedPlace?.point} searchedPlaceLabel={searchedPlace?.label} returnPoint={returnPoint} onReturnToPoint={disabled ? undefined : returnToPoint} onCenterChange={moveMap} onZoomChange={setZoom} />
          <div className="flex flex-wrap items-center gap-2">
            <button ref={expandButtonRef} type="button" disabled={disabled} onClick={() => setExpanded(true)} className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border px-5 font-semibold text-foreground hover:border-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning disabled:cursor-not-allowed disabled:text-disabled">Ampliar mapa</button>
            {mapControls}
          </div>
        </div>
        {feedback}
        <button type="button" onClick={onClose} className="min-h-11 font-semibold text-foreground underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning">Ocultar mapa</button>
      </> : null}

      {expanded ? <dialog ref={dialogRef} aria-labelledby="event-location-map-dialog-title" onClose={() => setExpanded(false)} className="m-auto max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-y-auto rounded-2xl border-2 border-border bg-background p-4 text-foreground backdrop:bg-background/85 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="event-location-map-dialog-title" className="font-display text-2xl font-black uppercase leading-tight">Escolha o ponto do encontro</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">O ponto exato fica privado. Busque um local público ou mova o pino no mapa.</p></div>
            <button type="button" aria-label="Voltar ao formulário" onClick={closeExpandedMap} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border-2 border-border hover:border-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg></button>
          </div>
          {searchForm}
          {searchResults}
          <OpenStreetMapView center={center} zoom={zoom} tileUrlTemplate={tileUrlTemplate} attributionUrl={attributionUrl} interactive pointSelected={pointSelected} searchedPlacePoint={searchedPlace?.point} searchedPlaceLabel={searchedPlace?.label} returnPoint={returnPoint} onReturnToPoint={disabled ? undefined : returnToPoint} mapHeightClassName="h-[min(58dvh,40rem)] min-h-64" onCenterChange={moveMap} onZoomChange={setZoom} />
          {mapControls}
          {feedback}
          <button type="button" onClick={closeExpandedMap} className="min-h-11 font-semibold text-foreground underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning">Voltar ao formulário</button>
        </div>
      </dialog> : null}
    </div>
  );
}

export function ApproximateAreaMap({ center, radiusMeters, tileUrlTemplate, attributionUrl }: Readonly<{ center: MapPoint; radiusMeters: number; tileUrlTemplate: string; attributionUrl: string }>) {
  return <OpenStreetMapView center={center} zoom={approximateAreaZoom(center, radiusMeters)} tileUrlTemplate={tileUrlTemplate} attributionUrl={attributionUrl} areaRadiusMeters={radiusMeters} />;
}
