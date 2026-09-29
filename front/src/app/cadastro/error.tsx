'use client';

import { BrandMark } from '@/components/server/ui/brand-mark';
import { Button, ButtonLink } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';

/** Route error boundary: no stack, no request data, a manual retry and a way out. */
export default function RegistrationError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-8 px-5 py-6 sm:px-8">
      <BrandMark size="sm" />
      <Notice tone="error" role="alert" title="O cadastro não carregou">
        Pode ser uma instabilidade momentânea. Tente de novo em instantes.
      </Notice>
      <div className="flex flex-col gap-3">
        <Button wide onClick={reset}>
          Tentar novamente
        </Button>
        <ButtonLink href="/" variant="secondary" wide>
          Voltar ao início
        </ButtonLink>
      </div>
    </main>
  );
}
