'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import { cn } from '@/shared/ui/cn';

type DialogProps = Readonly<{
  open: boolean;
  /** Called on Esc, on a click outside and after a programmatic close; must be idempotent. */
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  children: ReactNode;
}>;

/**
 * Modal built on the native `<dialog>`: the browser traps focus, makes the page inert, closes on
 * Esc and restores focus to the control that opened it. The element is only synchronized with
 * `open`, so the parent stays the single source of truth.
 */
export function Dialog({ open, onClose, labelledBy, describedBy, role = 'dialog', className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border-2 border-border bg-card p-0 text-foreground open:flex',
        'backdrop:bg-background/85',
        className,
      )}
    >
      {children}
    </dialog>
  );
}
