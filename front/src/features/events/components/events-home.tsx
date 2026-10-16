'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { ButtonLink } from '@/components/server/ui/button';
import { getEventDraftReference, readEventDraftReference } from '../draft-reference';

function currentDraftReference(): string | undefined {
  try { return getEventDraftReference(window.sessionStorage); } catch { return undefined; }
}

export function EventsHome() {
  const eventId = useSyncExternalStore(() => () => {}, currentDraftReference, () => undefined);
  useEffect(() => { try { readEventDraftReference(window.sessionStorage); } catch { /* Session storage is optional. */ } }, []);

  return (
    <main className="grid gap-10 pb-16 pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16 lg:pt-16">
      <section aria-labelledby="events-title" className="space-y-5">
        <h1 id="events-title" className="font-display text-[clamp(2.75rem,9vw,5rem)] font-black uppercase leading-[0.9] tracking-[-0.025em] poster-stretch text-balance">
          Um encontro.<br /><span className="text-primary">Um convite claro.</span>
        </h1>
        <p className="max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
          Organize uma atividade gratuita, informal e presencial. Você decide o que entra no convite; o ponto exato fica protegido.
        </p>
      </section>

      <section aria-label="Criar ou continuar um encontro" className="space-y-5 border-y-2 border-border py-6 lg:py-8">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Comece pelo essencial</h2>
          <p className="max-w-[56ch] leading-relaxed text-muted-foreground">
            Você pode salvar o rascunho e voltar a ele nesta sessão. Publicar é sempre uma ação explícita.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/eventos/novo" forward prefetch={false}>Criar encontro</ButtonLink>
          {eventId ? <Link className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border px-5 font-semibold text-foreground hover:border-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning" href={`/eventos/novo/${encodeURIComponent(eventId)}`} prefetch={false}>Continuar rascunho</Link> : null}
        </div>
        {eventId ? <p role="status" className="text-sm text-muted-foreground">Encontramos um rascunho salvo nesta sessão.</p> : null}
      </section>
    </main>
  );
}
