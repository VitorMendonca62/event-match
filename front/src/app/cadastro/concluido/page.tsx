import type { Metadata } from 'next';

import { CityPosterArt } from '@/components/server/city-poster-art';
import { BrandMark } from '@/components/server/ui/brand-mark';
import { ButtonLink } from '@/components/server/ui/button';
import { PosterHeadline } from '@/features/registration/components/poster-headline';

export const metadata: Metadata = { title: 'Cadastro concluído · EventMatch' };

/** Shows no account data: the continuation was revoked and nothing identifying reaches this page. */
export default function RegistrationCompletedPage() {
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
          Sua conta está ativa. Em breve você vai poder entrar, descobrir encontros perto de você e completar seu
          perfil quando quiser.
        </p>
        <ButtonLink href="/" variant="secondary" wide className="lg:w-auto lg:self-start">
          Voltar ao início
        </ButtonLink>
      </section>
    </main>
  );
}
