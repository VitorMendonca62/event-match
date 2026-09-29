import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/ui/cn';

import { ChevronRightIcon, SpinnerIcon } from './icons';

type Variant = 'primary' | 'secondary' | 'quiet';

const BASE =
  'inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-6 font-sans font-bold transition-[background-color,border-color,color,transform] duration-200 ease-out-expo select-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active active:scale-[0.99] disabled:bg-card disabled:text-disabled aria-disabled:bg-card aria-disabled:text-disabled',
  secondary:
    'border-2 border-border bg-transparent text-foreground hover:border-muted-foreground active:bg-card disabled:text-disabled disabled:hover:border-border',
  quiet:
    'min-h-11 px-3 font-sans font-semibold text-muted-foreground underline decoration-border decoration-2 hover:text-foreground hover:decoration-primary disabled:text-disabled',
};

export function buttonClasses(variant: Variant = 'primary', wide = false): string {
  return cn(BASE, VARIANTS[variant], wide && 'w-full', variant === 'primary' && 'min-h-14 text-lg');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  wide?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  /** Trailing chevron for forward actions, as in the poster CTA. */
  forward?: boolean;
};

export function Button({
  variant = 'primary',
  wide = false,
  pending = false,
  pendingLabel,
  forward = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses(variant, wide), forward && 'justify-between ps-8 pe-5', className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      <ButtonContent pending={pending} pendingLabel={pendingLabel} forward={forward}>
        {children}
      </ButtonContent>
    </button>
  );
}

function ButtonContent({
  pending,
  pendingLabel,
  forward,
  children,
}: Readonly<{ pending: boolean; pendingLabel?: string; forward: boolean; children: ReactNode }>) {
  if (pending) {
    return (
      <span className="mx-auto inline-flex items-center gap-3">
        <SpinnerIcon className="size-5 animate-spin" />
        {pendingLabel ?? children}
      </span>
    );
  }
  return (
    <>
      <span className={cn(forward && 'mx-auto')}>{children}</span>
      {forward ? <ChevronRightIcon className="size-6 shrink-0" strokeWidth={2.6} /> : null}
    </>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; wide?: boolean; forward?: boolean };

export function ButtonLink({ variant = 'primary', wide = false, forward = false, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses(variant, wide), forward && 'justify-between ps-8 pe-5', className)} {...props}>
      <span className={cn(forward && 'mx-auto')}>{children}</span>
      {forward ? <ChevronRightIcon className="size-6 shrink-0" strokeWidth={2.6} /> : null}
    </Link>
  );
}
