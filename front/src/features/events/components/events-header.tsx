import { BrandMark } from '@/components/server/ui/brand-mark';
import { ButtonLink } from '@/components/server/ui/button';
import { LogoutButton } from '@/features/authentication/components/logout-button';
import { SessionKeeper } from '@/features/authentication/components/session-keeper';

export function EventsHeader({ backHref = '/inicio', backLabel = 'Voltar ao início' }: Readonly<{ backHref?: string; backLabel?: string }>) {
  return (
    <>
      <SessionKeeper />
      <header className="flex items-center justify-between gap-4 py-6">
        <BrandMark size="sm" href="/inicio" />
        <nav aria-label="Navegação da conta" className="flex items-center gap-2 sm:gap-4">
          <ButtonLink href={backHref} variant="quiet" prefetch={false} aria-label={backLabel}>
            <span className="sm:hidden">{backHref === '/inicio' ? 'Início' : 'Encontros'}</span>
            <span className="hidden sm:inline">{backLabel}</span>
          </ButtonLink>
          <LogoutButton />
        </nav>
      </header>
    </>
  );
}
