'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/server/ui/button';
import { SproutIcon } from '@/components/server/ui/icons';

export function ProfileInvitation({ completed, total }: Readonly<{ completed: number; total: number }>) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function dismiss() {
    setPending(true);
    try {
      const result = await fetch('/api/profile/invitation/dismiss', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (result.status === 401) { router.push('/entrar'); return; }
      if (result.ok) { setHidden(true); setMessage('Lembraremos você novamente em sete dias.'); }
      else setMessage('Não foi possível adiar agora. Tente novamente.');
    } catch {
      setMessage('Não foi possível adiar agora. Verifique sua conexão e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  if (hidden) return <p role="status" className="rounded-2xl border-2 border-success/50 bg-surface p-4 text-muted-foreground">{message}</p>;
  return (
    <li className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span aria-hidden className="shrink-0 text-primary"><SproutIcon className="size-6" /></span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold text-foreground">Completar perfil</p>
        <p className="text-muted-foreground">Prepare como você será apresentado em atividades. {completed} de {total} itens concluídos.</p>
        <div role="progressbar" aria-label="Progresso do perfil" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(completed / total) * 100}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Link href="/perfil" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground hover:bg-primary-hover">Completar perfil</Link>
        <Button variant="quiet" pending={pending} pendingLabel="Adiando…" onClick={dismiss}>Agora não</Button>
      </div>
      {message ? <span className="sr-only" aria-live="polite">{message}</span> : null}
    </li>
  );
}
