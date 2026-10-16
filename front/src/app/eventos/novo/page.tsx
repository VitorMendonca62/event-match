import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Notice } from '@/components/server/ui/notice';
import { CreateEventDraftAction } from '@/features/events/components/create-event-draft-action';
import { EventsHeader } from '@/features/events/components/events-header';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { currentSessionView } from '@/shared/server/authenticated-view';

export const metadata: Metadata = { title: 'Criar encontro · EventMatch', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const env = getBffEnv();
  if (!env.EVENTS_UI_ENABLED) notFound();
  const session = await currentSessionView();
  if (!session.enabled) notFound();
  if (session.view === 'anonymous') redirect('/entrar');

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-5 pb-16 sm:px-8 lg:px-10">
      <EventsHeader backHref="/eventos" backLabel="Voltar a encontros" />
      <main className="grid gap-10 pb-12 pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-16 lg:pt-16">
        <section aria-labelledby="new-event-title" className="space-y-5">
          <h1 id="new-event-title" className="font-display text-[clamp(2.75rem,9vw,5rem)] font-black uppercase leading-[0.9] tracking-[-0.025em] poster-stretch text-balance">
            Comece pelo<br /><span className="text-primary">essencial.</span>
          </h1>
          <p className="max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
            Um rascunho só começa quando você pedir. Depois, escolha uma atividade, combine horário e lugar e revise o convite antes de publicar.
          </p>
        </section>

        <section aria-label="Iniciar rascunho" className="space-y-5 border-y-2 border-border py-6 lg:py-8">
          {session.view === 'authenticated' ? <>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">O ponto exato fica protegido</h2>
              <p className="max-w-[58ch] leading-relaxed text-muted-foreground">
                A prévia mostra apenas município e estado. O evento é gratuito, presencial e não comercial.
              </p>
            </div>
            <CreateEventDraftAction />
          </> : <Notice tone={session.view === 'forbidden' ? 'blocked' : 'warning'} title={session.view === 'forbidden' ? 'Área indisponível' : 'Não conseguimos confirmar sua sessão.'}>{session.view === 'forbidden' ? 'Você pode sair e tentar mais tarde.' : 'Tente novamente em instantes.'}</Notice>}
        </section>
      </main>
    </div>
  );
}
