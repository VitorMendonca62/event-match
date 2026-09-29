import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

import { cn } from '@/shared/ui/cn';

import { CheckIcon } from './icons';

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'children'> & {
  type: 'checkbox' | 'radio';
  label: ReactNode;
  description?: ReactNode;
  /** Decorative leading glyph. */
  icon?: ReactNode;
  /** Short status shown as a tag, e.g. “Em breve”. */
  badge?: string;
  /** `chip` for dense lists such as interests; `card` for a few explained options. */
  appearance?: 'card' | 'chip';
};

/**
 * Native checkbox/radio kept in the accessibility tree and keyboard order, styled through its
 * label. Selection shows a check mark and a thicker border, so it never relies on color alone.
 */
export function Choice({
  type,
  label,
  description,
  icon,
  badge,
  appearance = 'card',
  className,
  disabled,
  ...props
}: ChoiceProps) {
  const id = useId();
  const descriptionId = description || badge ? `${id}-description` : undefined;
  const chip = appearance === 'chip';

  return (
    <label
      htmlFor={id}
      className={cn(
        'group relative flex cursor-pointer items-center gap-3 border-2 border-border bg-surface text-left transition-colors duration-200',
        'hover:border-muted-foreground has-[:checked]:border-foreground has-[:checked]:bg-primary-muted',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-warning',
        chip ? 'min-h-12 rounded-full py-2 ps-3 pe-4' : 'min-h-16 rounded-2xl p-4',
        disabled && 'cursor-not-allowed border-dashed bg-transparent hover:border-border',
        className,
      )}
    >
      <input
        id={id}
        type={type}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          'grid size-6 shrink-0 place-items-center border-2 border-muted-foreground text-transparent transition-colors',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
          'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-foreground',
          disabled && 'border-disabled',
        )}
      >
        <CheckIcon className="size-4" strokeWidth={3} />
      </span>
      {icon ? (
        <span aria-hidden className={cn('shrink-0', disabled ? 'text-disabled' : 'text-muted-foreground')}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn('block font-semibold', disabled ? 'text-disabled' : 'text-foreground')}>{label}</span>
        {description || badge ? (
          <span id={descriptionId} className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {badge ? (
              <span className="rounded-full border border-warning/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
                {badge}
              </span>
            ) : null}
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
