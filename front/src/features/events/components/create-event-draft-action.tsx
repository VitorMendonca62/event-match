'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/server/ui/button';
import { createEventDraft } from '../api';
import { saveEventDraftReference } from '../draft-reference';

export function CreateEventDraftAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function startDraft() {
    if (pending) return;
    setPending(true);
    setMessage(undefined);
    const result = await createEventDraft();
    if (result.kind === 'ok') {
      try { saveEventDraftReference(window.sessionStorage, result.data.id); } catch { /* The draft remains available by its URL. */ }
      router.replace(`/eventos/novo/${encodeURIComponent(result.data.id)}`);
      router.refresh();
      return;
    }
    setMessage(result.kind === 'expired'
      ? 'Sua sessão terminou. Entre novamente para criar um rascunho.'
      : result.kind === 'forbidden'
        ? 'Esta ação não está disponível para sua conta agora.'
        : result.kind === 'unavailable'
          ? 'Não conseguimos iniciar o rascunho agora. Tente novamente.'
          : 'Não foi possível iniciar o rascunho. Volte e tente novamente.');
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <Button type="button" forward pending={pending} pendingLabel="Preparando rascunho…" onClick={startDraft}>
        Criar rascunho
      </Button>
      {message ? <p role="alert" tabIndex={-1} className="max-w-[58ch] text-sm font-semibold text-error">{message}{message.includes('Entre novamente') ? <> <Link className="underline underline-offset-4" href="/entrar">Entrar</Link></> : null}</p> : null}
    </div>
  );
}
