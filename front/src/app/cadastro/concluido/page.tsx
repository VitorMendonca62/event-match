import type { Metadata } from 'next';
import { connection } from 'next/server';

import { CityPosterArt } from '@/components/server/city-poster-art';
import { BrandMark } from '@/components/server/ui/brand-mark';
import { ButtonLink } from '@/components/server/ui/button';
import { PosterHeadline } from '@/features/registration/components/poster-headline';
import { getBffEnv } from '@/shared/config/bff-env.server';

export const metadata: Metadata = { title: 'Cadastro concluído · EventMatch' };

/** Rollout flag read per request, so a rollback never ships a link to a hidden `/entrar`. */
function authUiEnabled(): boolean {
  try {
    return getBffEnv().AUTH_UI_ENABLED;
  } catch {
    return false;
  }
}

/**
 * Shows no account data: the continuation was revoked and nothing identifying reaches this page.
 * Login stays an explicit, separate step; registration never signs the person in (ADR-037).
 */
export default async function RegistrationCompletedPage() {
  await connection();
  const loginAvailable = authUiEnabled();

  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-10">
      <div className="px-5 pt-6 sm:px-8 lg:col-span-2 lg:px-0">
        <BrandMark size="sm" />
      </div>
      <div className="overflow-hidden lg:order-2">
        <CityPosterArt />
      </div>
      <section className="flex flex-col gap-6 px-5 pb-12 sm:px-8 lg:order-1 lg:px-0">
        <PosterHeadline lead="Cadastro concluído." accent="A cidade espera você." />
        <p className="max-w-[46ch] text-lg leading-relaxed text-foreground">
          {loginAvailable
            ? 'Sua conta está ativa. Entre com o e-mail e a senha que você acabou de cadastrar para começar.'
            : 'Sua conta está ativa. Em breve você vai poder entrar, descobrir encontros perto de você e completar seu perfil quando quiser.'}
        </p>
        {loginAvailable ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <ButtonLink href="/entrar" wide forward className="lg:w-auto lg:min-w-72">
              Entrar no EventMatch
            </ButtonLink>
            <ButtonLink href="/" variant="quiet" className="self-center lg:self-auto">
              Voltar ao início
            </ButtonLink>
          </div>
        ) : (
          <ButtonLink href="/" variant="secondary" wide className="lg:w-auto lg:self-start">
            Voltar ao início
          </ButtonLink>
        )}
      </section>
    </main>
  );
}
