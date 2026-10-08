/** @format */

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Dialog } from '@/components/client/ui/dialog';
import { Button } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';

import { ownProfileSchema, signedUploadGrantSchema, type OwnProfile } from '../contracts';
import {
  getCropFrame,
  isProfileImageLargeEnough,
  type ImageDimensions,
} from '../profile-image-crop';
import { ProfileVisibilityToggle } from './profile-visibility-toggle';

const MAX_BYTES = 5_242_880;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

async function square(file: File, x: number, y: number, zoom: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const base = Math.min(bitmap.width, bitmap.height) / zoom;
  const sx = (bitmap.width - base) * (x / 100);
  const sy = (bitmap.height - base) * (y / 100);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  canvas.getContext('2d')?.drawImage(bitmap, sx, sy, base, base, 0, 0, 1024, 1024);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.88),
  );
  if (!blob) throw new Error('crop');
  return new File([blob], 'profile.webp', { type: 'image/webp' });
}

export function ProfilePhotoEditor({
  profile,
  onProfile,
}: Readonly<{ profile: OwnProfile; onProfile: (profile: OwnProfile) => void }>) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [dimensions, setDimensions] = useState<ImageDimensions>();
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [pending, setPending] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'error' | 'success' | 'warning';
    text: string;
  }>();
  const dragRef = useRef<
    | { kind: 'move'; pointerId: number; startClientX: number; startClientY: number; x: number; y: number }
    | { kind: 'resize'; pointerId: number; startClientX: number; startClientY: number; zoom: number }
    | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function choose(next: File | undefined) {
    setMessage(undefined);
    if (!next) {
      setEditorOpen(false);
      setFile(undefined);
      setPreview(undefined);
      setDimensions(undefined);
      return;
    }
    if (!TYPES.has(next.type) || next.size > MAX_BYTES) {
      setFile(undefined);
      setPreview(undefined);
      setDimensions(undefined);
      setMessage({
        tone: 'error',
        text: 'Escolha JPEG, PNG ou WebP estático de até 5 MiB.',
      });
      return;
    }
    try {
      const bitmap = await createImageBitmap(next);
      const nextDimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (!isProfileImageLargeEnough(nextDimensions)) {
        setEditorOpen(false);
        setFile(undefined);
        setPreview(undefined);
        setDimensions(undefined);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setMessage({
          tone: 'error',
          text: 'Esta imagem é pequena demais. Escolha uma imagem com pelo menos 320 × 320 px.',
        });
        return;
      }
      setDimensions(nextDimensions);
      setX(50);
      setY(50);
      setZoom(1);
      setFile(next);
      setPreview(URL.createObjectURL(next));
      setEditorOpen(true);
    } catch {
      setMessage({ tone: 'error', text: 'Não foi possível abrir essa imagem.' });
    }
  }

  function resetEditor() {
    setEditorOpen(false);
    setFile(undefined);
    setPreview(undefined);
    setDimensions(undefined);
    dragRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function readCurrentProfile(): Promise<OwnProfile | null> {
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      if (response.status === 401) {
        router.push('/entrar');
        return null;
      }
      if (!response.ok) return null;
      const envelope = await response.json();
      const parsed = ownProfileSchema.safeParse(envelope.data);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  function acceptSavedPhoto(savedProfile: OwnProfile) {
    onProfile(savedProfile);
    resetEditor();
    setMessage({ tone: 'success', text: 'Foto principal atualizada.' });
  }

  const cropFrame = dimensions ? getCropFrame(dimensions, x, y, zoom) : undefined;

  function startMove(event: PointerEvent<HTMLDivElement>) {
    if (!cropFrame || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: 'move',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x,
      y,
    };
  }

  function moveCrop(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'move' || drag.pointerId !== event.pointerId || !cropFrame) return;
    const stage = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!stage) return;
    const availableX = (cropFrame.maxLeftPercent / 100) * stage.width;
    const availableY = (cropFrame.maxTopPercent / 100) * stage.height;
    if (availableX > 0)
      setX(clamp(drag.x + ((event.clientX - drag.startClientX) / availableX) * 100, 0, 100));
    if (availableY > 0)
      setY(clamp(drag.y + ((event.clientY - drag.startClientY) / availableY) * 100, 0, 100));
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      zoom,
    };
  }

  function resizeCrop(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'resize' || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const inwardDistance =
      (drag.startClientX - event.clientX + drag.startClientY - event.clientY) / 120;
    setZoom(clamp(drag.zoom + inwardDistance, 1, 4));
  }

  function nudgeCrop(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 8 : 2;
    if (event.key === 'ArrowLeft') setX((value) => clamp(value - step, 0, 100));
    else if (event.key === 'ArrowRight') setX((value) => clamp(value + step, 0, 100));
    else if (event.key === 'ArrowUp') setY((value) => clamp(value - step, 0, 100));
    else if (event.key === 'ArrowDown') setY((value) => clamp(value + step, 0, 100));
    else return;
    event.preventDefault();
  }

  async function upload() {
    if (!file) return;
    setPending(true);
    setMessage(undefined);
    let finalizationStarted = false;
    try {
      const grantResponse = await fetch('/api/profile/photo/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: profile.revision }),
      });
      if (grantResponse.status === 401) {
        router.push('/entrar');
        return;
      }
      if (!grantResponse.ok) throw new Error('grant');
      const grantEnvelope = await grantResponse.json();
      const grant = signedUploadGrantSchema.parse(grantEnvelope.data);
      const cropped = await square(file, x, y, zoom);
      const data = new FormData();
      data.set('file', cropped);
      data.set('api_key', grant.apiKey);
      data.set('timestamp', String(grant.timestamp));
      data.set('signature', grant.signature);
      data.set('upload_preset', grant.uploadPreset);
      data.set('public_id', grant.publicId);
      data.set('type', 'authenticated');
      const uploaded = await fetch(grant.uploadUrl, { method: 'POST', body: data });
      if (!uploaded.ok) throw new Error('upload');
      const rawProviderResponse = (await uploaded.json()) as Record<string, unknown>;
      const providerResponse = {
        asset_id: rawProviderResponse.asset_id,
        public_id: rawProviderResponse.public_id,
        version: rawProviderResponse.version,
        signature: rawProviderResponse.signature,
        format: rawProviderResponse.format,
        bytes: rawProviderResponse.bytes,
        width: rawProviderResponse.width,
        height: rawProviderResponse.height,
      };
      finalizationStarted = true;
      const finalized = await fetch(
        `/api/profile/photo/uploads/${grant.uploadId}/finalize`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ revision: profile.revision, providerResponse }),
        },
      );
      if (finalized.status === 401) {
        router.push('/entrar');
        return;
      }
      const body = await finalized.json().catch(() => null);
      const parsed = ownProfileSchema.safeParse(body?.data);
      if (finalized.ok && parsed.success) {
        acceptSavedPhoto(parsed.data);
        return;
      }
      const reconciled = await readCurrentProfile();
      if (reconciled?.photo && reconciled.revision > profile.revision) {
        acceptSavedPhoto(reconciled);
        return;
      }
      throw new Error('finalize');
    } catch {
      if (finalizationStarted) {
        const reconciled = await readCurrentProfile();
        if (reconciled?.photo && reconciled.revision > profile.revision) {
          acceptSavedPhoto(reconciled);
          return;
        }
      }
      resetEditor();
      setMessage({
        tone: 'error',
        text: 'Não foi possível enviar a foto. Sua foto atual foi preservada; tente novamente.',
      });
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await fetch('/api/profile/photo', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: profile.revision }),
      });
      if (result.status === 401) {
        router.push('/entrar');
        return;
      }
      const body = await result.json();
      const parsed = ownProfileSchema.safeParse(body.data);
      if (result.ok && parsed.success) {
        onProfile(parsed.data);
        setMessage({ tone: 'success', text: 'Foto removida.' });
      } else
        setMessage({ tone: 'error', text: 'Não foi possível remover a foto agora.' });
    } catch {
      setMessage({
        tone: 'error',
        text: 'Não foi possível remover a foto. Verifique sua conexão e tente novamente.',
      });
    } finally {
      setPending(false);
      setRemoveConfirm(false);
    }
  }

  return (
    <section aria-labelledby="profile-photo" className="space-y-5 border-b border-border pb-10">
      <div>
        <h2 id="profile-photo" className="text-xl font-bold">Foto principal</h2>
        <p className="mt-1 text-muted-foreground">
          Escolha o enquadramento que será usado como sua foto quadrada.
        </p>
      </div>
      {message ? <Notice role="status" tone={message.tone} title={message.text} /> : null}

      <div>
        <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
          {profile.photo ? (
            <Image
              unoptimized
              width={160}
              height={160}
              src={profile.photo.deliveryUrl}
              alt="Foto principal atual"
              referrerPolicy="no-referrer"
              className="aspect-square size-40 rounded-2xl border-2 border-border object-cover"
            />
          ) : (
            <div className="grid aspect-square size-40 place-items-center rounded-2xl border-2 border-dashed border-border bg-surface text-center text-sm text-muted-foreground">
              Nenhuma foto
            </div>
          )}
          <div className="space-y-4">
            <label
              onDragEnter={() => setDraggingFile(true)}
              onDragLeave={() => setDraggingFile(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setDraggingFile(false);
                void choose(event.dataTransfer.files[0]);
              }}
              className={`block cursor-pointer rounded-2xl border-2 border-dashed p-5 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-warning ${draggingFile ? 'border-primary bg-primary-muted' : 'border-border bg-surface hover:border-muted-foreground'}`}
            >
              <span className="block font-semibold">Escolher imagem</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Arraste ou selecione JPEG, PNG ou WebP; mínimo 320 × 320 px e até 5 MiB.
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  event.stopPropagation();
                  void choose(event.target.files?.[0]);
                }}
                className="sr-only"
              />
            </label>
            {profile.photo ? (
              removeConfirm ? (
                <div className="space-y-3 rounded-2xl border-2 border-warning/60 p-4">
                  <p>Remover a foto principal?</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" pending={pending} onClick={remove}>Sim, remover</Button>
                    <Button variant="quiet" onClick={() => setRemoveConfirm(false)}>Manter foto</Button>
                  </div>
                </div>
              ) : (
                <Button variant="quiet" onClick={() => setRemoveConfirm(true)}>Remover foto</Button>
              )
            ) : null}
          </div>
        </div>
      </div>

      <Dialog
        open={editorOpen && Boolean(file && preview && cropFrame)}
        onClose={resetEditor}
        labelledBy="profile-photo-editor-title"
        describedBy="profile-photo-editor-description"
        returnFocus={() => fileInputRef.current}
        className="max-w-4xl"
      >
      {file && preview && cropFrame ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-border p-4 sm:p-5">
            <div>
              <h2 id="profile-photo-editor-title" className="text-xl font-bold">Editar foto</h2>
              <p id="profile-photo-editor-description" className="mt-1 text-sm text-muted-foreground">
                Arraste o quadrado para posicionar. Arraste a alça para redimensionar.
              </p>
            </div>
            <Button variant="quiet" onClick={resetEditor}>Fechar</Button>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-border bg-background touch-none select-none">
            <Image
              unoptimized
              fill
              sizes="(max-width: 640px) calc(100vw - 4rem), 42rem"
              src={preview}
              alt="Imagem completa para recorte"
              draggable={false}
              className="pointer-events-none object-contain"
            />
            <div
              role="group"
              tabIndex={0}
              aria-label="Área quadrada de recorte. Arraste com o mouse ou use as setas do teclado."
              style={cropFrame.style}
              onPointerDown={startMove}
              onPointerMove={moveCrop}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
              onKeyDown={nudgeCrop}
              className="absolute cursor-move border-3 border-primary outline-offset-4 focus-visible:outline-3 focus-visible:outline-warning"
            >
              <span aria-hidden="true" className="absolute inset-x-1/3 top-0 bottom-0 border-x border-primary-foreground/60" />
              <span aria-hidden="true" className="absolute inset-y-1/3 left-0 right-0 border-y border-primary-foreground/60" />
              <button
                type="button"
                aria-label="Redimensionar área de recorte"
                onPointerDown={startResize}
                onPointerMove={resizeCrop}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
                className="absolute -bottom-5 -right-5 grid size-11 cursor-nwse-resize place-items-center rounded-lg bg-transparent outline-offset-1 focus-visible:outline-3 focus-visible:outline-warning"
              >
                <span aria-hidden="true" className="size-7 rounded-md border-2 border-primary-foreground bg-primary" />
              </button>
            </div>
          </div>
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="sr-only">Ajustes precisos do recorte</legend>
            <CropRange label="Horizontal" accessibleLabel="Posição horizontal do recorte" value={x} min={0} max={100} step={1} onChange={setX} />
            <CropRange label="Vertical" accessibleLabel="Posição vertical do recorte" value={y} min={0} max={100} step={1} onChange={setY} />
            <CropRange label="Ampliação" accessibleLabel="Ampliação do recorte" value={zoom} min={1} max={4} step={0.1} onChange={setZoom} />
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button pending={pending} pendingLabel="Enviando…" onClick={upload}>Usar este recorte</Button>
            <Button variant="secondary" onClick={() => { setX(50); setY(50); setZoom(1); }}>Redefinir recorte</Button>
            <Button variant="quiet" onClick={resetEditor}>Cancelar</Button>
          </div>
          </div>
        </div>
      ) : null}
      </Dialog>

      <ProfileVisibilityToggle
        name="photoVisibility"
        question="Quem poderá ver a foto futuramente?"
        description="Ative para permitir que pessoas no EventMatch vejam sua foto quando esse recurso estiver disponível."
        defaultChecked={profile.photoVisibility === 'authenticated'}
      />
    </section>
  );
}

function CropRange({
  label,
  accessibleLabel,
  value,
  min,
  max,
  step,
  onChange,
}: Readonly<{
  label: string;
  accessibleLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}>) {
  const buttonStep = step < 1 ? step : 5;
  const update = (next: number) => onChange(clamp(next, min, max));
  return (
    <div className="block text-sm font-semibold text-foreground">
      <span className="flex items-center justify-between gap-2">
        {label}
        <span className="tabular text-muted-foreground">
          {label === 'Ampliação' ? `${value.toFixed(1)}×` : `${Math.round(value)}%`}
        </span>
      </span>
      <div className="mt-2 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        <RangeStepButton label={`Diminuir ${label.toLocaleLowerCase('pt-BR')}`} onClick={() => update(value - buttonStep)} direction="minus" />
        <input
          aria-label={accessibleLabel}
          className="block min-h-11 w-full cursor-ew-resize accent-primary"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={(event) => update(Number(event.currentTarget.value))}
        />
        <RangeStepButton label={`Aumentar ${label.toLocaleLowerCase('pt-BR')}`} onClick={() => update(value + buttonStep)} direction="plus" />
      </div>
    </div>
  );
}

function RangeStepButton({ label, onClick, direction }: Readonly<{
  label: string;
  onClick: () => void;
  direction: 'minus' | 'plus';
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-lg border-2 border-border bg-card text-foreground hover:border-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-warning"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 10h12" />
        {direction === 'plus' ? <path d="M10 4v12" /> : null}
      </svg>
    </button>
  );
}
