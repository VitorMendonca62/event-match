import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BrandMark } from '@/components/server/ui/brand-mark';
import { LoginForm } from '@/features/authentication/components/login-form';
import { PosterHeadline } from '@/features/registration/components/poster-headline';
import { currentSessionView } from '@/shared/server/authenticated-view';

export const metadata: Metadata = {
  title: 'Entrar · EventMatch',
  referrer: 'no-referrer',
};

/**
 * Login (ADR-037). A person already connected is sent to `/inicio` on the server, before any form
 * renders; the only client island is the form itself.
 */
export default async function LoginPage() {
  const { enabled, view } = await currentSessionView();
  if (!enabled) notFound();
  if (view === 'authenticated' || view === 'forbidden') redirect('/inicio');

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-16 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4 py-6">
        <BrandMark size="sm" />
        <Link
          href="/cadastro"
          className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-muted-foreground underline decoration-border decoration-2 underline-offset-4 transition-colors duration-200 hover:text-foreground hover:decoration-primary"
        >
          Criar cadastro
        </Link>
      </header>
      <main className="flex-1 pt-6 lg:pt-16">
        <section
          aria-labelledby="login-title"
          className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16"
        >
          <div className="space-y-5">
            <PosterHeadline id="login-title" size="step" lead="Bom te ver" accent="de volta." />
            <div className="max-w-[52ch] space-y-4 text-lg leading-relaxed text-muted-foreground">
              <p>Entre com o e-mail e a senha do seu cadastro para continuar no EventMatch.</p>
              <p className="text-base">
                Esqueceu a senha? A recuperação ainda não está disponível e chega em uma próxima etapa do
                EventMatch.
              </p>
            </div>
          </div>
          <div className="animate-rise-in min-w-0 space-y-6 lg:pt-2">
            <LoginForm />
            <p className="text-muted-foreground">
              Ainda não tem conta?{' '}
              <Link
                href="/cadastro"
                className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4"
              >
                Criar meu cadastro
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
