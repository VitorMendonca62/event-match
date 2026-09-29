import type { ReactNode, Ref } from 'react';

import { cn } from '@/shared/ui/cn';

import { AlertIcon, CheckIcon, InfoIcon, LockIcon } from './icons';

type Tone = 'info' | 'success' | 'warning' | 'error' | 'blocked';

const TONES: Record<Tone, { frame: string; icon: string; Icon: typeof InfoIcon; label: string }> = {
  info: { frame: 'border-border bg-surface', icon: 'text-muted-foreground', Icon: InfoIcon, label: 'Informação' },
  success: { frame: 'border-success/50 bg-surface', icon: 'text-success', Icon: CheckIcon, label: 'Tudo certo' },
  warning: { frame: 'border-warning/60 bg-surface', icon: 'text-warning', Icon: AlertIcon, label: 'Atenção' },
  error: { frame: 'border-error/70 bg-surface', icon: 'text-error', Icon: AlertIcon, label: 'Erro' },
  blocked: { frame: 'border-border bg-card', icon: 'text-disabled', Icon: LockIcon, label: 'Indisponível' },
};

type NoticeProps = Readonly<{
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  id?: string;
  /** `alert` interrupts; `status` is announced politely; omit for static content. */
  role?: 'alert' | 'status';
  ref?: Ref<HTMLDivElement>;
  className?: string;
}>;

/** State message whose meaning is carried by icon + visible label + text, never by color alone. */
export function Notice({ tone = 'info', title, children, id, role, ref, className }: NoticeProps) {
  const { frame, icon, Icon, label } = TONES[tone];
  return (
    <div
      id={id}
      ref={ref}
      role={role}
      tabIndex={ref ? -1 : undefined}
      className={cn('flex gap-3 rounded-2xl border-2 p-4 text-left', frame, className)}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', icon)} />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground">
          <span className="sr-only">{label}: </span>
          {title}
        </p>
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
