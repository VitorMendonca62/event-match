import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Notice } from '@/components/server/ui/notice';
import { EventForm } from '@/features/events/components/event-form';
import { EventsHeader } from '@/features/events/components/events-header';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { loadEventActivityTypes, loadFederativeUnits } from '@/shared/server/catalog-bff';
import { currentSessionView } from '@/shared/server/authenticated-view';

export const metadata: Metadata = { title: 'Editar encontro · EventMatch', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: Readonly<{ params: Promise<{ eventId: string }> }>) {
  const env = getBffEnv();
  if (!env.EVENTS_UI_ENABLED) notFound();
  const [{ eventId }, session, activityCatalog, locationCatalog] = await Promise.all([
    params,
    currentSessionView(),
    loadEventActivityTypes({ env }),
    loadFederativeUnits({ env }),
  ]);
  if (!session.enabled) notFound();
  if (session.view === 'anonymous') redirect('/entrar');

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-5 pb-16 sm:px-8 lg:px-10">
      <EventsHeader backHref="/eventos" backLabel="Voltar a encontros" />
      <main className="pb-12 pt-6 lg:pt-10">
        {session.view === 'authenticated'
          ? <EventForm eventId={eventId} activityOptions={activityCatalog.kind === 'ok' ? activityCatalog.items : []} catalogAvailable={activityCatalog.kind === 'ok'} federativeUnits={locationCatalog.kind === 'ok' ? locationCatalog.items : []} locationCatalogAvailable={locationCatalog.kind === 'ok'} mapTileUrlTemplate={env.EVENT_MAP_TILE_URL_TEMPLATE ?? ''} mapAttributionUrl={env.EVENT_MAP_ATTRIBUTION_URL ?? ''} />
          : <div className="max-w-2xl"><Notice tone={session.view === 'forbidden' ? 'blocked' : 'warning'} title={session.view === 'forbidden' ? 'Área indisponível' : 'Não conseguimos confirmar sua sessão.'}>{session.view === 'forbidden' ? 'Você pode sair e tentar mais tarde.' : 'Tente novamente em instantes.'}</Notice></div>}
      </main>
    </div>
  );
}
