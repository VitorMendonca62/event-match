'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';

export type MapPoint = Readonly<{ latitude: number; longitude: number }>;

const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;
const MOUSE_DRAG_SENSITIVITY = 0.45;
const WHEEL_DELTA_PER_ZOOM = 160;
export const MIN_MAP_ZOOM = 3;
export const MAX_MAP_ZOOM = 19;

function toWorld(point: MapPoint, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.latitude));
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
    scale,
  };
}

function fromWorld(x: number, y: number, zoom: number): MapPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return {
    latitude: Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)),
    longitude: Math.max(-180, Math.min(180, longitude)),
  };
}

function tileUrl(template: string, zoom: number, x: number, y: number) {
  return template.replaceAll('{z}', String(zoom)).replaceAll('{x}', String(x)).replaceAll('{y}', String(y));
}

type Props = Readonly<{
  center: MapPoint;
  zoom: number;
  tileUrlTemplate: string;
  attributionUrl: string;
  interactive?: boolean;
  pointSelected?: boolean;
  searchedPlacePoint?: MapPoint;
  searchedPlaceLabel?: string;
  returnPoint?: MapPoint;
  areaRadiusMeters?: number;
  mapHeightClassName?: string;
  onCenterChange?: (point: MapPoint) => void;
  onReturnToPoint?: () => void;
  onZoomChange?: (zoom: number) => void;
}>;

export function OpenStreetMapView({ center, zoom, tileUrlTemplate, attributionUrl, interactive = false, pointSelected = false, searchedPlacePoint, searchedPlaceLabel, returnPoint, areaRadiusMeters, mapHeightClassName = 'h-72', onCenterChange, onReturnToPoint, onZoomChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; pointerType: string; x: number; y: number; worldX: number; worldY: number } | undefined>(undefined);
  const wheelDeltaRef = useRef(0);
  const [size, setSize] = useState({ width: 640, height: 320 });
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const changeZoom = onZoomChange;
    if (!root || !interactive || !changeZoom) return;

    function onWheel(event: WheelEvent) {
      if (event.deltaY === 0) return;
      const deltaY = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 40
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * (rootRef.current?.clientHeight ?? 0) : event.deltaY;
      const accumulatedDelta = wheelDeltaRef.current + deltaY;
      const zoomDirection = accumulatedDelta < 0 ? 1 : -1;
      const availableSteps = zoomDirection > 0 ? MAX_MAP_ZOOM - zoom : zoom - MIN_MAP_ZOOM;
      if (availableSteps < 1) {
        wheelDeltaRef.current = 0;
        return;
      }
      event.preventDefault();
      const requestedSteps = Math.floor(Math.abs(accumulatedDelta) / WHEEL_DELTA_PER_ZOOM);
      if (requestedSteps < 1) {
        wheelDeltaRef.current = accumulatedDelta;
        return;
      }
      const appliedSteps = Math.min(requestedSteps, availableSteps, 1);
      wheelDeltaRef.current = requestedSteps > 1
        ? 0
        : accumulatedDelta - Math.sign(accumulatedDelta) * appliedSteps * WHEEL_DELTA_PER_ZOOM;
      changeZoom?.(Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom + zoomDirection * appliedSteps)));
    }

    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [interactive, onZoomChange, zoom]);

  const projected = toWorld(center, zoom);
  const topLeft = { x: projected.x - size.width / 2, y: projected.y - size.height / 2 };
  const searchedPlaceProjected = searchedPlacePoint ? toWorld(searchedPlacePoint, zoom) : undefined;
  const searchedPlaceScreenPoint = searchedPlaceProjected
    ? { x: searchedPlaceProjected.x - topLeft.x, y: searchedPlaceProjected.y - topLeft.y }
    : undefined;
  const mapCenterScreenPoint = { x: size.width / 2, y: size.height / 2 };
  const searchedPlaceOffset = searchedPlaceScreenPoint
    ? { x: searchedPlaceScreenPoint.x - mapCenterScreenPoint.x, y: searchedPlaceScreenPoint.y - mapCenterScreenPoint.y }
    : undefined;
  const searchedPlaceDistance = searchedPlaceOffset ? Math.hypot(searchedPlaceOffset.x, searchedPlaceOffset.y) : Number.POSITIVE_INFINITY;
  const searchedPlaceDisplayPoint = searchedPlaceScreenPoint && searchedPlaceOffset && searchedPlaceDistance < 78
    ? (() => {
      const unitX = searchedPlaceDistance === 0 ? Math.SQRT1_2 : searchedPlaceOffset.x / searchedPlaceDistance;
      const unitY = searchedPlaceDistance === 0 ? -Math.SQRT1_2 : searchedPlaceOffset.y / searchedPlaceDistance;
      return { x: searchedPlaceScreenPoint.x + unitX * 48, y: searchedPlaceScreenPoint.y + unitY * 48 };
    })()
    : searchedPlaceScreenPoint;
  const tiles = useMemo(() => {
    const firstX = Math.floor(topLeft.x / TILE_SIZE);
    const lastX = Math.floor((topLeft.x + size.width) / TILE_SIZE);
    const firstY = Math.floor(topLeft.y / TILE_SIZE);
    const lastY = Math.floor((topLeft.y + size.height) / TILE_SIZE);
    const total = 2 ** zoom;
    const visible: { key: string; url: string; left: number; top: number }[] = [];
    for (let rawX = firstX; rawX <= lastX; rawX += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        if (y < 0 || y >= total) continue;
        const x = ((rawX % total) + total) % total;
        visible.push({
          key: `${zoom}/${x}/${y}`,
          url: tileUrl(tileUrlTemplate, zoom, x, y),
          left: rawX * TILE_SIZE - topLeft.x,
          top: y * TILE_SIZE - topLeft.y,
        });
      }
    }
    return visible;
  }, [size.height, size.width, tileUrlTemplate, topLeft.x, topLeft.y, zoom]);

  function panPixels(deltaX: number, deltaY: number) {
    const world = toWorld(center, zoom);
    onCenterChange?.(fromWorld(world.x + deltaX, world.y + deltaY, zoom));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || event.button !== 0 || (event.target as HTMLElement).closest('button,a')) return;
    const world = toWorld(center, zoom);
    wheelDeltaRef.current = 0;
    panRef.current = { pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, worldX: world.x, worldY: world.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!interactive || !pan || pan.pointerId !== event.pointerId) return;
    const sensitivity = pan.pointerType === 'mouse' ? MOUSE_DRAG_SENSITIVITY : 1;
    onCenterChange?.(fromWorld(pan.worldX - (event.clientX - pan.x) * sensitivity, pan.worldY - (event.clientY - pan.y) * sensitivity, zoom));
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = undefined;
  }

  function onMapKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    const move = event.key === 'ArrowRight' ? [48, 0]
      : event.key === 'ArrowLeft' ? [-48, 0]
        : event.key === 'ArrowDown' ? [0, 48]
          : event.key === 'ArrowUp' ? [0, -48]
            : undefined;
    if (!move) return;
    event.preventDefault();
    panPixels(move[0] ?? 0, move[1] ?? 0);
  }

  const metersPerPixel = (Math.cos((center.latitude * Math.PI) / 180) * 2 * Math.PI * 6_378_137) / projected.scale;
  const areaDiameter = areaRadiusMeters ? (areaRadiusMeters * 2) / Math.max(metersPerPixel, 0.01) : undefined;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={interactive ? `Mapa para posicionar o ponto do encontro${pointSelected ? ', ponto central escolhido' : ''}${searchedPlaceLabel ? `, local pesquisado marcado: ${searchedPlaceLabel}` : ''}` : 'Mapa da área aproximada do encontro'}
      aria-describedby={interactive ? 'event-location-map-controls-help' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={onMapKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={`relative ${mapHeightClassName} w-full select-none overflow-hidden rounded-xl border-2 border-border bg-card focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning ${interactive ? 'touch-none cursor-grab active:cursor-grabbing' : ''}`}
    >
      {interactive ? <span id="event-location-map-controls-help" className="sr-only">Arraste o mapa com o mouse para mover o pino. Use a roda do mouse ou os botões mais e menos dentro do mapa para mudar o zoom; as setas do teclado também deslocam o mapa.</span> : null}
      {tiles.map((tile) => (
        <Image key={tile.key} src={tile.url} alt="" aria-hidden="true" width={TILE_SIZE} height={TILE_SIZE} unoptimized loading="eager" referrerPolicy="origin" onError={() => setTileError(true)} draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }} />
      ))}
      {tileError ? <p role="status" className="absolute left-2 top-16 z-10 max-w-[85%] rounded bg-background/95 px-3 py-2 text-sm font-semibold text-foreground">Os mapas não carregaram. Tente novamente mais tarde; a busca por nome continua disponível.</p> : null}
      {areaDiameter ? <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-[3px] border-primary bg-primary/20" style={{ width: areaDiameter, height: areaDiameter, transform: 'translate(-50%, -50%)' }} /> : null}
      {interactive && searchedPlaceScreenPoint && searchedPlaceDisplayPoint && searchedPlaceDistance < 78 ? <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none"><line x1={searchedPlaceScreenPoint.x} y1={searchedPlaceScreenPoint.y} x2={searchedPlaceDisplayPoint.x} y2={searchedPlaceDisplayPoint.y} stroke="var(--warning)" strokeWidth="3" strokeDasharray="5 4" /></svg> : null}
      {interactive && searchedPlaceDisplayPoint ? <div aria-hidden="true" className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-full" style={{ left: searchedPlaceDisplayPoint.x, top: searchedPlaceDisplayPoint.y }}><svg viewBox="0 0 32 42" className="block h-11 w-8"><path d="M16 40S3 24 3 15a13 13 0 1 1 26 0c0 9-13 25-13 25Z" fill="var(--warning)" stroke="var(--primary-foreground)" strokeWidth="3" /><circle cx="16" cy="15" r="4" fill="var(--primary-foreground)" /></svg></div> : null}
      {interactive ? <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-full"><svg viewBox="0 0 32 42" className="block h-11 w-8"><path d="M16 40S3 24 3 15a13 13 0 1 1 26 0c0 9-13 25-13 25Z" fill={pointSelected ? 'var(--success)' : 'var(--primary)'} stroke="var(--primary-foreground)" strokeWidth="3" /><circle cx="16" cy="15" r="4" fill="var(--primary-foreground)" /></svg></div> : null}
      {interactive && onZoomChange ? <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-xl border-2 border-border bg-background">
        <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" disabled={zoom >= MAX_MAP_ZOOM} onClick={() => { wheelDeltaRef.current = 0; onZoomChange(Math.min(MAX_MAP_ZOOM, zoom + 1)); }} className="grid size-11 place-items-center border-b-2 border-border text-foreground hover:bg-surface focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-warning disabled:cursor-not-allowed disabled:text-disabled">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[2.5]"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
        </button>
        <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom" disabled={zoom <= MIN_MAP_ZOOM} onClick={() => { wheelDeltaRef.current = 0; onZoomChange(Math.max(MIN_MAP_ZOOM, zoom - 1)); }} className="grid size-11 place-items-center text-foreground hover:bg-surface focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-warning disabled:cursor-not-allowed disabled:text-disabled">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[2.5]"><path d="M5 12h14" strokeLinecap="round" /></svg>
        </button>
      </div> : null}
      {interactive && returnPoint && onReturnToPoint ? <button type="button" onClick={onReturnToPoint} className="absolute left-3 top-3 z-10 min-h-11 rounded-xl border-2 border-border bg-background px-3 font-semibold text-foreground hover:bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-warning">Voltar ao ponto</button> : null}
      <a href={attributionUrl} target="_blank" rel="noreferrer" className="absolute bottom-1 right-1 rounded bg-background/90 px-1.5 py-1 text-xs font-semibold text-foreground underline underline-offset-2" aria-label="Créditos do mapa: OpenStreetMap contributors">© OpenStreetMap contributors</a>
    </div>
  );
}

export function approximateAreaZoom(point: MapPoint, radiusMeters: number) {
  const metersAtZoomZero = Math.cos((point.latitude * Math.PI) / 180) * 2 * Math.PI * 6_378_137 / TILE_SIZE;
  return Math.max(10, Math.min(16, Math.floor(Math.log2((metersAtZoomZero * 56) / radiusMeters))));
}
