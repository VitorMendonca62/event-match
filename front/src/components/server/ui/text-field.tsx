import { type InputHTMLAttributes, type Ref, useId } from 'react';

import { cn } from '@/shared/ui/cn';

import { AlertIcon } from './icons';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  /** Why the data is requested, or format help; linked through `aria-describedby`. */
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
  inputClassName?: string;
};

export function TextField({ label, hint, error, className, inputClassName, ref, ...props }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="block font-semibold text-foreground">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'block min-h-13 w-full rounded-xl border-2 bg-surface px-4 text-lg text-foreground transition-colors duration-200',
          'placeholder:text-disabled hover:border-muted-foreground focus-visible:border-foreground focus-visible:outline-offset-2',
          'disabled:cursor-not-allowed disabled:text-disabled',
          error ? 'border-error' : 'border-border',
          inputClassName,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-sm font-semibold text-error">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
