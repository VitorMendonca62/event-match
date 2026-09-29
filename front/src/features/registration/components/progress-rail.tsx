import { cn } from '@/shared/ui/cn';

import { STEP_LABELS, STEPS, type Step, stepIndex } from '../flow-machine';

/** Progress told in text (“Etapa 3 de 8”) and by segment height, never by color alone. */
export function ProgressRail({ current }: Readonly<{ current: Step }>) {
  const index = stepIndex(current);
  return (
    <nav aria-label="Progresso do cadastro" className="space-y-3">
      <p className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-display font-bold uppercase tracking-[0.18em] text-foreground">
          Etapa <span className="tabular">{index + 1}</span> de <span className="tabular">{STEPS.length}</span>
        </span>
        <span className="text-muted-foreground">{STEP_LABELS[current]}</span>
      </p>
      <ol className="flex h-3 items-end gap-1.5">
        {STEPS.map((step, position) => {
          const state = position < index ? 'concluída' : position === index ? 'atual' : 'pendente';
          return (
            <li
              key={step}
              aria-current={position === index ? 'step' : undefined}
              className={cn(
                'flex-1 rounded-full transition-[height,background-color] duration-500 ease-out-expo',
                state === 'concluída' && 'h-1.5 bg-foreground',
                state === 'atual' && 'h-3 bg-primary',
                state === 'pendente' && 'h-1.5 bg-border',
              )}
            >
              <span className="sr-only">
                {STEP_LABELS[step]}: {state}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
