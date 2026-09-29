import type { ReactNode, Ref } from 'react';

import { ArrowLeftIcon } from '@/components/server/ui/icons';
import { cn } from '@/shared/ui/cn';

import { type Step, stepIndex } from '../flow-machine';

type StepFrameProps = Readonly<{
  step: Step;
  title: string;
  /** Why this data is requested and what it unlocks, next to the form it explains. */
  why: ReactNode;
  headingRef: Ref<HTMLHeadingElement>;
  onBack?: () => void;
  children: ReactNode;
}>;

/**
 * Editorial frame of one step: a numbered poster band, the step title (focus target on every step
 * change) and the reason for the data. On desktop the explanation sits beside its form.
 */
export function StepFrame({ step, title, why, headingRef, onBack, children }: StepFrameProps) {
  const number = String(stepIndex(step) + 1).padStart(2, '0');
  return (
    <section
      aria-labelledby={`step-${step}-title`}
      className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16"
    >
      <div className="space-y-5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ms-3 inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-5" />
            Voltar
          </button>
        ) : null}
        <div className="flex items-stretch gap-4">
          <span
            aria-hidden
            className="animate-band-in flex w-14 shrink-0 flex-col items-center justify-between rounded-b-lg bg-primary px-1 pb-2 pt-3 text-foreground"
          >
            <span className="font-display text-2xl font-black leading-none tabular">{number}</span>
            <span className="mt-3 h-0.5 w-5 bg-foreground" />
          </span>
          <div className="flex min-w-0 items-end py-1">
            <h1
              id={`step-${step}-title`}
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-[clamp(2rem,6vw,3.25rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] [word-spacing:0.12em] text-balance poster-stretch focus:outline-none"
            >
              {title}
            </h1>
          </div>
        </div>
        <div className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground">{why}</div>
      </div>
      <div className={cn('animate-rise-in min-w-0 space-y-6 lg:pt-2')}>{children}</div>
    </section>
  );
}
