import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/server/ui/button';
import { BrandMark } from '@/components/server/ui/brand-mark';
import { PinIcon, SproutIcon } from '@/components/server/ui/icons';
import { Notice } from '@/components/server/ui/notice';
import { LogoutButton } from '@/features/authentication/components/logout-button';
import { SessionKeeper } from '@/features/authentication/components/session-keeper';
import { PosterHeadline } from '@/features/registration/components/poster-headline';
import { currentSessionView } from '@/shared/server/authenticated-view';
import { currentProfileView } from '@/shared/server/profile-view';
import { invitationDismissed, profileInvitationCookieName } from '@/shared/server/profile-invitation-cookie';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { cookies } from 'next/headers';
import { ProfileInvitation } from '@/features/profile/components/profile-invitation';

export const metadata: Metadata = {
  title: 'Início · EventMatch',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

type NextStep = Readonly<{ title: string; description: string; icon: ReactNode }>;

// Static copy hoisted out of render (`rendering-hoist-jsx`); nothing here is personal data.
const NEXT_STEPS: readonly NextStep[] = [
  {
    title: 'Completar perfil',
    description: 'Conte um pouco mais sobre você e escolha o que outras pessoas podem ver.',
    icon: <SproutIcon className="size-6" />,
  },
  {
    title: 'Descobrir encontros',
    description: 'Encontre atividades gratuitas perto de você, a partir dos seus interesses.',
    icon: <PinIcon className="size-6" />,
  },
];

/**
 * First authenticated area (ADR-037). The session is validated on the server before anything
 * renders; no name, e-mail or id is shown or serialized. Unavailable next steps are plain text with
 * an “Em breve” tag, never controls.
 */
export default async function HomePage() {
  const [session, profile, cookieStore] = await Promise.all([currentSessionView(), currentProfileView(), cookies()]);
  const { enabled, view } = session;
  if (!enabled) notFound();
  if (view === 'anonymous') redirect('/entrar');

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-16 sm:px-8 lg:px-10">
      <SessionKeeper />
      <header className="flex items-center justify-between gap-4 py-6">
        <BrandMark size="sm" href="/inicio" />
        <LogoutButton />
      </header>
      <main className="flex-1 pt-6 lg:pt-16">
        {view === 'authenticated' ? <Welcome profile={profile} cookieValue={cookieStore.get(profileInvitationCookieName(getBffEnv()))?.value} /> : <Unavailable forbidden={view === 'forbidden'} />}
      </main>
    </div>
  );
}

function Welcome({ profile, cookieValue }: Readonly<{ profile: Awaited<ReturnType<typeof currentProfileView>>; cookieValue?: string }>) {
  const showInvitation = profile.kind === 'ok' && !profile.value.completion.complete && !invitationDismissed(cookieValue, profile.value.invitationSubject);
  return (
    <section aria-labelledby="home-title" className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <div className="space-y-5">
        <PosterHeadline id="home-title" size="step" lead="Você entrou" accent="no EventMatch." />
        <p className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
          Sua conta está ativa e sua sessão está aberta neste aparelho. Quando terminar, use “Sair”,
          principalmente em aparelhos compartilhados.
        </p>
      </div>
      <section aria-labelledby="next-steps-title" className="animate-rise-in min-w-0 space-y-4 lg:pt-2">
        <h2 id="next-steps-title" className="text-lg font-bold text-foreground">
          Próximos passos
        </h2>
        <ul className="divide-y divide-border rounded-2xl border-2 border-border bg-surface">
          {showInvitation ? <ProfileInvitation completed={profile.value.completion.completedCount} total={profile.value.completion.totalCount} /> : null}
          {NEXT_STEPS.filter((step) => step.title !== 'Completar perfil').map((step) => (
            <li key={step.title} className="flex items-start gap-4 p-5">
              <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
                {step.icon}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-foreground">{step.title}</span>
                  <span className="rounded-full border border-warning/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
                    Em breve
                  </span>
                </p>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ul>
        {profile.kind !== 'ok' && profile.kind !== 'disabled' ? <Notice tone="warning" title="Não conseguimos carregar seu perfil agora.">Tente novamente em instantes.</Notice> : null}
      </section>
    </section>
  );
}

/** `forbidden` keeps the session (ADR-036) but shows no private content nor the reason. */
function Unavailable({ forbidden }: Readonly<{ forbidden: boolean }>) {
  return (
    <section aria-labelledby="home-unavailable-title" className="max-w-2xl space-y-6">
      <h1
        id="home-unavailable-title"
        className="font-display text-[clamp(2rem,6vw,3.25rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-balance poster-stretch"
      >
        {forbidden ? 'Área indisponível' : 'Não conseguimos confirmar'}
      </h1>
      {forbidden ? (
        <Notice tone="blocked" title="Esta área não está disponível para sua conta agora.">
          Você pode sair e tentar mais tarde.
        </Notice>
      ) : (
        <Notice tone="warning" role="status" title="Não conseguimos confirmar sua sessão agora.">
          Tente novamente em instantes.
        </Notice>
      )}
      {forbidden ? null : (
        <ButtonLink href="/inicio" variant="secondary" prefetch={false}>
          Tentar novamente
        </ButtonLink>
      )}
    </section>
  );
}
