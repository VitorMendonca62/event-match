import Link from 'next/link';

import { cn } from '@/shared/ui/cn';

type BrandMarkProps = Readonly<{ size?: 'lg' | 'sm'; href?: string; className?: string }>;

/** Wordmark set in the poster face; no logo asset exists yet (PRODUCT.md, Evidence on Hand). */
export function BrandMark({ size = 'lg', href = '/', className }: BrandMarkProps) {
  const large = size === 'lg';
  return (
    <Link href={href} className={cn('inline-block rounded-md', className)} aria-label="EventMatch, início">
      <span
        className={cn(
          'block font-display font-extrabold leading-none tracking-[-0.03em]',
          large ? 'text-4xl sm:text-5xl' : 'text-2xl',
        )}
      >
        <span className="text-foreground">Event</span>
        <span className="text-primary">Match</span>
      </span>
      {large ? (
        <span aria-hidden className="mt-2 flex items-center gap-1.5 whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:gap-2 sm:text-[0.6875rem] sm:tracking-[0.28em]">
          Pessoas <Dot /> Atividades <Dot /> Cidades
        </span>
      ) : null}
    </Link>
  );
}

function Dot() {
  return <span className="size-1 rounded-full bg-primary" />;
}
