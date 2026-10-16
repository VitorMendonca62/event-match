import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Notice } from '@/components/server/ui/notice';
import { EventsHome } from '@/features/events/components/events-home';
import { EventsHeader } from '@/features/events/components/events-header';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { currentSessionView } from '@/shared/server/authenticated-view';

export const metadata: Metadata = { title: 'Encontros · EventMatch', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const env = getBffEnv();
  if (!env.EVENTS_UI_ENABLED) notFound();
  const session = await currentSessionView();
  if (!session.enabled) notFound();
  if (session.view === 'anonymous') redirect('/entrar');

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-5 pb-16 sm:px-8 lg:px-10">
      <EventsHeader />
      {session.view === 'authenticated'
        ? <EventsHome />
        : <main className="max-w-2xl pt-12"><Notice tone={session.view === 'forbidden' ? 'blocked' : 'warning'} title={session.view === 'forbidden' ? 'Área indisponível' : 'Não conseguimos confirmar sua sessão.'}>{session.view === 'forbidden' ? 'Você pode sair e tentar mais tarde.' : 'Tente novamente em instantes.'}</Notice></main>}
    </div>
  );
}
